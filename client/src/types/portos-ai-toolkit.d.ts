declare module 'portos-ai-toolkit/client' {
  import { ComponentType } from 'react';

  export interface AIProvidersProps {
    onError?: (message: string) => void;
    colorPrefix?: string;
  }

  export const AIProviders: ComponentType<AIProvidersProps>;
}
