import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('agreement')
export class AgreementEntity {
    @PrimaryColumn({ name: 'id', type: 'uuid' })
    public id: string;

    @Column({ name: 'name' })
    public name: string;

    @Column({ name: 'reference' })
    public reference: string;

    @Column({ name: 'state' })
    public state: string;

    @Column({ name: 'api_url', nullable: true })
    public apiUrl?: string;

    @Column({ name: 'auth_type', nullable: true })
    public authType?: string;

    @Column({ name: 'auth_config', type: 'jsonb', nullable: true })
    public authConfig?: Record<string, any>;

    @Column({ name: 'created_at' })
    public createdAt: Date;

    @Column({ name: 'updated_at' })
    public updatedAt: Date;

    @Column({ name: 'deleted_at', nullable: true })
    public deletedAt?: Date;
}
