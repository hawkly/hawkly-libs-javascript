import {
  Card,
  CardClassification,
} from './index';

export class Warden {

  private keys: PrivateKeyPair[];

  constructor(keys: PrivateKeyPair[]) {
    this.keys = keys;
  }

  public createCard(options: CreateCardOptions): string {
    // TODO: typecheck the options

    // Assemble the card
    const card: Card = {
      uuid: options.uuid,
      classification: options.classification,
      roles: options.roles,
      issued: options.issued || Date.now(),
    };

    // Add the tenant if there is one
    if (options.tenant) {
      card.tenant = options.tenant;
    }

    return JSON.stringify(card);
  }

}

export interface CreateCardOptions {
  // A unique identifier for the card holder
  uuid: string;
  // Optionally the tenant of which the card holder is part of
  tenant?: string;

  // This card's classification
  classification: CardClassification;

  // Roles assigned to the user, typically used for permissions
  roles: string[];

  // The time when this card was created
  // This should be used for testing the library, or if you need to correct
  // for clock skew
  issued?: number;
};

export interface PrivateKeyPair {
  public: string;
  private: string;

  // Keys are tried in order of newest to oldest
  expires: number;
}
