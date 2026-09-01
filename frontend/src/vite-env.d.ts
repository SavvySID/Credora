/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_INDEXER_STREAM_URL?: string;
  readonly VITE_LOAN_CONTRACT_ADDRESS?: string;
  readonly VITE_0G_CHAIN_ID?: string;
  readonly VITE_0G_EXPLORER_URL?: string;
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
