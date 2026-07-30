import { HttpStatus, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CONCILIATION_REPOSITORY } from '../../../domain/conciliation.repository';
import type { IConciliationRepository } from '../../../domain/conciliation.repository';
import { Conciliation } from '../../../domain/conciliation';
import { ConciliationMatch } from '../../../domain/conciliation-match';
import { TRANSACTION_REPOSITORY } from '@features/transactions/domain/transaction.repository';
import type { ITransactionRepository } from '@features/transactions/domain/transaction.repository';
import { RunConciliationCommand } from './command';
import { ConciliationResponse } from '../../queries/get-conciliations/response.dto';
import { ResponseMetadataBuilder } from '@shared/core/response/api-response-metadata-builder';
import { ConciliationCompletedEvent } from '@features/conciliation/application/events/conciliation-completed.event';
import { BANK_ACCOUNT_REPOSITORY } from '@features/accounts/domain/account.repository';
import type { IBankAccountRepository } from '@features/accounts/domain/account.repository';
import { OutboxService } from '@shared/outbox';

@CommandHandler(RunConciliationCommand)
export class RunConciliationHandler implements ICommandHandler<RunConciliationCommand> {
    public constructor(
        @Inject(CONCILIATION_REPOSITORY)
        private readonly conciliationRepository: IConciliationRepository,
        @Inject(TRANSACTION_REPOSITORY)
        private readonly transactionRepository: ITransactionRepository,
        @Inject(BANK_ACCOUNT_REPOSITORY)
        private readonly accountRepository: IBankAccountRepository,
        private readonly eventEmitter: EventEmitter2,
        private readonly outboxService: OutboxService,
    ) {}

    public async execute(
        _command: RunConciliationCommand,
    ): Promise<ConciliationResponse> {
        const bankATxs = (
            await this.transactionRepository.findAll(
                1,
                10000,
                undefined,
                undefined,
                undefined,
                undefined,
                'bank_a',
            )
        ).items;
        const bankBTxs = (
            await this.transactionRepository.findAll(
                1,
                10000,
                undefined,
                undefined,
                undefined,
                undefined,
                'bank_b',
            )
        ).items;

        const bankBMap = new Map(
            bankBTxs
                .filter((t) => t.correlationId)
                .map((t) => [t.correlationId!, t]),
        );

        let matched = 0;
        let discrepancies = 0;
        let missing = 0;
        const matchBuilders: ConciliationMatch[] = [];
        const conciliationId = crypto.randomUUID();

        for (const txA of bankATxs) {
            if (!txA.correlationId) continue;

            const txB = bankBMap.get(txA.correlationId);
            if (!txB) {
                missing++;
                matchBuilders.push(
                    ConciliationMatch.Builder.setId(crypto.randomUUID())
                        .setConciliationId(conciliationId)
                        .setInternalTxId(txA.id)
                        .setStatus('missing')
                        .setAmountDiff(0)
                        .build(),
                );
                continue;
            }

            const diff = (txA.amount ?? 0) - (txB.amount ?? 0);
            if (diff === 0) {
                matched++;
                matchBuilders.push(
                    ConciliationMatch.Builder.setId(crypto.randomUUID())
                        .setConciliationId(conciliationId)
                        .setInternalTxId(txA.id)
                        .setExternalTxId(txB.id)
                        .setStatus('matched')
                        .setAmountDiff(0)
                        .build(),
                );
            } else {
                discrepancies++;
                matchBuilders.push(
                    ConciliationMatch.Builder.setId(crypto.randomUUID())
                        .setConciliationId(conciliationId)
                        .setInternalTxId(txA.id)
                        .setExternalTxId(txB.id)
                        .setStatus('discrepancy')
                        .setAmountDiff(diff)
                        .build(),
                );
            }
            bankBMap.delete(txA.correlationId);
        }

        for (const [, txB] of bankBMap) {
            missing++;
            matchBuilders.push(
                ConciliationMatch.Builder.setId(crypto.randomUUID())
                    .setConciliationId(conciliationId)
                    .setInternalTxId(txB.id)
                    .setStatus('missing')
                    .setAmountDiff(0)
                    .build(),
            );
        }

        const conciliation = Conciliation.Builder.setId(conciliationId)
            .setRunAt(new Date())
            .setStatus('completed')
            .setSummary({ matched, discrepancies, missing })
            .build();

        await this.conciliationRepository.createConciliation(conciliation);

        for (const match of matchBuilders) {
            await this.conciliationRepository.createMatch(match);
        }

        const processedIds = new Set<string>();
        for (const match of matchBuilders) {
            if (match.status !== 'matched' && match.status !== 'discrepancy')
                continue;

            if (match.internalTxId && !processedIds.has(match.internalTxId)) {
                processedIds.add(match.internalTxId);
                const txA = bankATxs.find((t) => t.id === match.internalTxId);
                if (txA) {
                    const account = await this.accountRepository.findById(
                        txA.bankAccountId,
                    );
                    await this.outboxService.save({
                        aggregateId: txA.id,
                        eventType: 'transaction.completed',
                        payload: {
                            transaction: {
                                id: txA.id,
                                amount: txA.amount,
                                operation: txA.operation,
                                type: txA.type,
                                state: txA.state,
                                description: txA.description,
                                bankAccountId: txA.bankAccountId,
                                correlationId: txA.correlationId,
                                sourceBank: txA.sourceBank,
                                createdAt: txA.createdAt.toISOString(),
                                updatedAt: txA.updatedAt.toISOString(),
                            },
                            agreementId: account?.agreementId,
                        },
                    });
                }
            }

            if (match.externalTxId && !processedIds.has(match.externalTxId)) {
                processedIds.add(match.externalTxId);
                const txB = bankBTxs.find((t) => t.id === match.externalTxId);
                if (txB) {
                    const account = await this.accountRepository.findById(
                        txB.bankAccountId,
                    );
                    await this.outboxService.save({
                        aggregateId: txB.id,
                        eventType: 'transaction.completed',
                        payload: {
                            transaction: {
                                id: txB.id,
                                amount: txB.amount,
                                operation: txB.operation,
                                type: txB.type,
                                state: txB.state,
                                description: txB.description,
                                bankAccountId: txB.bankAccountId,
                                correlationId: txB.correlationId,
                                sourceBank: txB.sourceBank,
                                createdAt: txB.createdAt.toISOString(),
                                updatedAt: txB.updatedAt.toISOString(),
                            },
                            agreementId: account?.agreementId,
                        },
                    });
                }
            }
        }

        this.eventEmitter.emit(
            ConciliationCompletedEvent.eventName,
            new ConciliationCompletedEvent(conciliationId, 'completed', {
                matched,
                discrepancies,
                missing,
            }),
        );

        const metadata = new ResponseMetadataBuilder()
            .setStatusCode(HttpStatus.CREATED)
            .setMessage('Conciliation completed')
            .build();

        return new ConciliationResponse(
            (await this.conciliationRepository.findById(
                conciliationId,
            )) as NonNullable<
                Awaited<ReturnType<IConciliationRepository['findById']>>
            >,
            metadata,
        );
    }
}
