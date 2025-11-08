export interface TransactionInput {
  address: string;
  amount: string;
  tx_hash: string;
}

export interface TransactionOutput {
  address: string;
  amount: string;
}

export interface Transaction {
  tx_hash: string;
  block_height: number;
  block_time: number;
  inputs: TransactionInput[];
  outputs: TransactionOutput[];
}

