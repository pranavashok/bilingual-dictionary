import { TableEntity } from '@azure/data-tables';
import { Request } from 'express';

export interface Config {
  storageAccount: string;
  storageAccessKey: string;
  connectionString: string;
  postClientItem: string;
  postServerItem: string;
  env: string;
  db1: string;
  db2: string;
}

export interface CustomRequest extends Request {
  user?: any;
}

export interface SuggestionBody {
  name: string;
  email: string;
  suggestion: string;
}

export interface Entity extends TableEntity {
  [key: string]: any;
}

export interface QueryOptions {
  select?: string[];
  top?: number;
  filter?: string;
}