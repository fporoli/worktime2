import { SetMetadata } from '@nestjs/common';

export const SKIP_ONBOARDED_KEY = 'skipOnboarded';
export const SkipOnboarded = (): MethodDecorator & ClassDecorator => SetMetadata(SKIP_ONBOARDED_KEY, true);
