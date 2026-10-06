import { describeFileStoreContract } from './contract.testkit';
import { MemoryFileStore } from './memory';

describeFileStoreContract('memory', () => Promise.resolve(new MemoryFileStore()));
