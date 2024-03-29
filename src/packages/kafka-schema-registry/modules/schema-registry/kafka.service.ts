import { SchemaRegistry } from '@kafkajs/confluent-schema-registry';
import { ClientKafka, KafkaOptions } from '@nestjs/microservices';
import { from, lastValueFrom, Observable } from 'rxjs';
import { SchemaRegistryClient } from '@/packages/kafka-schema-registry/modules/schema-registry/schema-registry.client';
import { Kafka } from 'kafkajs';

export class KafkaService extends ClientKafka {
    private readonly schemaRegistry: SchemaRegistry;

    constructor(
        options: KafkaOptions['options'] & {
            schemaRegistry: SchemaRegistryClient;
        },
    ) {
        super(options);
        this.schemaRegistry = options.schemaRegistry;
    }

    override emit<TResult = any, TInput = any>(
        pattern: any,
        payload: TInput,
    ): Observable<TResult> {
        return from(this.emitEncodedMessage(pattern, payload));
    }

    private async emitEncodedMessage(pattern: any, payload: any) {
        const encodedPayload = await this.encode(pattern, payload);

        return lastValueFrom(super.emit(pattern, encodedPayload));
    }

    private async encode(topic: string, payload: any) {
        const subject = `${topic}-value`;
        const id =
            this.schemaRegistry.cache?.getLatestRegistryId(subject) ??
            (await this.schemaRegistry
                .getLatestSchemaId(subject)
                .then((id) => {
                    this.schemaRegistry.cache?.setLatestRegistryId(subject, id);
                    return id;
                })
                .catch((e) => {
                    this.logger.error(e);
                    return null;
                }));

        if (!payload.value) {
            payload = { value: payload };
        }

        if (!id) return payload;

        payload.value = await this.schemaRegistry
            .encode(id, payload.value)
            .catch((e) => {
                console.log(`${topic} failed to encoded`, e, e?.paths);
                throw Error('Message Broker: Failed to encode message');
            });

        return payload;
    }

    async decode(
        message: Buffer | string | Record<string, unknown>,
    ): Promise<any> {
        if (Buffer.isBuffer(message)) {
            return this.schemaRegistry.decode(message);
        }

        if (typeof message === 'object' && message.value) {
            return Buffer.isBuffer(message.value)
                ? await this.schemaRegistry?.decode(message.value)
                : message.value;
        }
        return message;
    }

    async getClient(): Promise<Kafka> {
        return super.createClient();
    }
}
