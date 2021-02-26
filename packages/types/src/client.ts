import { Dsn } from './dsn';
import { Event, EventHint } from './event';
import { EventProcessor } from './eventprocessor';
import { Integration, IntegrationClass } from './integration';
import { Options, OptionsV7 } from './options';
import { Scope } from './scope';
import { Session } from './session';
import { Severity } from './severity';

/**
 * User-Facing Sentry SDK Client.
 *
 * This interface contains all methods to interface with the SDK once it has
 * been installed. It allows to send events to Sentry, record breadcrumbs and
 * set a context included in every event. Since the SDK mutates its environment,
 * there will only be one instance during runtime.
 *
 */
export interface ClientLike<O extends OptionsV7 = OptionsV7> {
  options: O;

  /**
   * Captures an exception event and sends it to Sentry.
   *
   * @param exception An exception-like object.
   * @param hint May contain additional information about the original exception.
   * @param scope An optional scope containing event metadata.
   * @returns The event id
   */
  captureException(exception: any, hint?: EventHint, scope?: Scope): string | undefined;

  /**
   * Captures a message event and sends it to Sentry.
   *
   * @param message The message to send to Sentry.
   * @param level Define the level of the message.
   * @param hint May contain additional information about the original exception.
   * @param scope An optional scope containing event metadata.
   * @returns The event id
   */
  captureMessage(message: string, level?: Severity, hint?: EventHint, scope?: Scope): string | undefined;

  /**
   * Captures a manually created event and sends it to Sentry.
   *
   * @param event The event to send to Sentry.
   * @param hint May contain additional information about the original exception.
   * @param scope An optional scope containing event metadata.
   * @returns The event id
   */
  captureEvent(event: Event, hint?: EventHint, scope?: Scope): string | undefined;

  /** Captures a session
   *
   * @param session Session to be delivered
   */
  captureSession?(session: Session): void;

  addEventProcessor(callback: EventProcessor): void;

  /** Returns the current Dsn. */
  getDsn(): Dsn | undefined;

  /**
   * A promise that resolves when all current events have been sent.
   * If you provide a timeout and the queue takes longer to drain the promise returns false.
   *
   * @param timeout Maximum time in ms the client should wait.
   */
  close(timeout?: number): PromiseLike<boolean>;

  /**
   * A promise that resolves when all current events have been sent.
   * If you provide a timeout and the queue takes longer to drain the promise returns false.
   *
   * @param timeout Maximum time in ms the client should wait.
   */
  flush(timeout?: number): PromiseLike<boolean>;

  /** Returns an array of installed integrations on the client. */
  getIntegration<T extends Integration>(integration: IntegrationClass<T>): T | null;
}

/**
 * User-Facing Sentry SDK Client.
 *
 * This interface contains all methods to interface with the SDK once it has
 * been installed. It allows to send events to Sentry, record breadcrumbs and
 * set a context included in every event. Since the SDK mutates its environment,
 * there will only be one instance during runtime.
 *
 */
export interface Client<O extends Options = Options> {
  options: O;

  /**
   * Captures an exception event and sends it to Sentry.
   *
   * @param exception An exception-like object.
   * @param hint May contain additional information about the original exception.
   * @param scope An optional scope containing event metadata.
   * @returns The event id
   */
  captureException(exception: any, hint?: EventHint, scope?: Scope): string | undefined;

  /**
   * Captures a message event and sends it to Sentry.
   *
   * @param message The message to send to Sentry.
   * @param level Define the level of the message.
   * @param hint May contain additional information about the original exception.
   * @param scope An optional scope containing event metadata.
   * @returns The event id
   */
  captureMessage(message: string, level?: Severity, hint?: EventHint, scope?: Scope): string | undefined;

  /**
   * Captures a manually created event and sends it to Sentry.
   *
   * @param event The event to send to Sentry.
   * @param hint May contain additional information about the original exception.
   * @param scope An optional scope containing event metadata.
   * @returns The event id
   */
  captureEvent(event: Event, hint?: EventHint, scope?: Scope): string | undefined;

  /** Captures a session
   *
   * @param session Session to be delivered
   */
  captureSession?(session: Session): void;

  /** Returns the current Dsn. */
  getDsn(): Dsn | undefined;

  /**
   * A promise that resolves when all current events have been sent.
   * If you provide a timeout and the queue takes longer to drain the promise returns false.
   *
   * @param timeout Maximum time in ms the client should wait.
   */
  close(timeout?: number): PromiseLike<boolean>;

  /**
   * A promise that resolves when all current events have been sent.
   * If you provide a timeout and the queue takes longer to drain the promise returns false.
   *
   * @param timeout Maximum time in ms the client should wait.
   */
  flush(timeout?: number): PromiseLike<boolean>;

  /** Returns an array of installed integrations on the client. */
  getIntegration<T extends Integration>(integration: IntegrationClass<T>): T | null;
}
