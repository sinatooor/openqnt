/**
 * Settings → Brokers credentials panel — thin wrapper around the existing
 * CredentialsTab component. Lives under the Brokers section.
 *
 * Note this is distinct from Settings → API Keys: this is the encrypted-on-
 * server credential vault used by the *trading-execution* path (Alpaca, IG,
 * IBKR, Nordnet). API Keys handles LLM / data-feed credentials stored in
 * the OS keychain on the client side.
 */
import { CredentialsTab } from '@/features/strategy-flow/components/modals/CredentialsTab';

export function CredentialsPanel() {
  return <CredentialsTab />;
}
