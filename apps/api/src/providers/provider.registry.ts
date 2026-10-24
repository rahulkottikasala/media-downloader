import { MediaProvider } from './types.js';
import { DirectMediaProvider } from './direct.provider.js';
import { LocalFileProvider } from './local.provider.js';
import { YouTubeProvider } from './youtube.provider.js';
import { InstagramProvider } from './instagram.provider.js';

export class ProviderRegistry {
  private providers: MediaProvider[] = [];

  constructor() {
    // Platform-specific first
    this.providers.push(new YouTubeProvider());
    this.providers.push(new InstagramProvider());
    this.providers.push(new DirectMediaProvider());
    this.providers.push(new LocalFileProvider());
  }

  register(provider: MediaProvider) {
    this.providers.unshift(provider);
  }

  findProvider(urlOrIdentifier: string): MediaProvider | null {
    for (const provider of this.providers) {
      if (provider.canHandle(urlOrIdentifier)) {
        return provider;
      }
    }
    return null;
  }

  getAllProviders(): MediaProvider[] {
    return [...this.providers];
  }
}

export const providerRegistry = new ProviderRegistry();
