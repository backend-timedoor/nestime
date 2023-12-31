import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class DemoScheduler {
    @Cron(CronExpression.EVERY_5_SECONDS)
    handleCron() {
        console.log('Called when the current second is 5');
    }
}
