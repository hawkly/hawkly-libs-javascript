import {
  Card,
  CardClassification,
  CardClassificationExpiryLengths,
} from './index';

export class Guard {

  private publicKey: string;

  constructor(
    publicKey: string | false = false,
  ) {
    if (publicKey === false) {
      throw new Error('Cannot create a Guard without a publicKey');
    }
    this.publicKey = publicKey;
  }

  public checkCard(cardString: string): Card {
    const card: Card = JSON.parse(cardString);

    const expiryTime: number = this.getClassificationExpiryTime(card.classification);
    if (expiryTime < card.issued) {
      throw new Error('Card has expired');
    }
    return card;
  }


  private getClassificationExpiryTime(classification: CardClassification): number {
    const expires: Date = new Date();
    switch (classification) {
      case CardClassification.access:
        expires.setMinutes(expires.getMinutes() + CardClassificationExpiryLengths.access);
        return expires.getTime();

      case CardClassification.refresh:
        expires.setMinutes(expires.getMinutes() + CardClassificationExpiryLengths.refresh);
        return expires.getTime();

      case CardClassification.mfa:
        expires.setMinutes(expires.getMinutes() + CardClassificationExpiryLengths.mfa);
        return expires.getTime();

      default:
        throw new Error('Invalid card');
    }
  }
}
