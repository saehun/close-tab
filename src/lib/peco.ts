import { spawn } from 'child_process';
import * as path from 'path';

const handleError =
  (reject: (reason?: any) => void, option: PecoOption) =>
  (error: Error): void => {
    if (option.onError === 'reject') {
      reject(error);
    } else {
      if (error.message.includes('ENOENT')) {
        // when 'peco' binary is not in path
        console.error(`command not found: peco\ninstall peco from https://github.com/peco/peco`);
      } else {
        console.error(error);
      }
      process.exit(1);
    }
  };

const getBinary = (option: PecoOption): string => {
  return option.bin ?? path.join(__dirname, '../../bin/peco');
};

const optionBuilder =
  (key: keyof PecoOption, cmdKey: string = key) =>
  (option: PecoOption): string => {
    const value = option[key];
    if (value) {
      return '--' + cmdKey + '=' + String(value);
    } else {
      return '';
    }
  };

const getOptions = (option: PecoOption): string[] =>
  [
    optionBuilder('query'),
    optionBuilder('prompt'),
    optionBuilder('rcfile'),
    optionBuilder('bufferSize', 'buffer-size'),
    optionBuilder('selectOne', 'select-1'),
    optionBuilder('printQuery', 'print-query'),
    optionBuilder('initialIndex', 'initial-index'),
    optionBuilder('initialFilter', 'initial-filter'),
    optionBuilder('selectionPrefix', 'selection-prefix'),
    optionBuilder('layout'),
  ]
    .map(build => build(option))
    .filter(s => s.length);

export interface PecoOption {
  /** javascript options */
  bin?: string;
  onCancel?: 'reject' | 'skip';
  onError?: 'reject' | 'exit';

  /** command line options */
  exec?: string;
  query?: string;
  prompt?: string;
  rcfile?: string;
  bufferSize?: number;
  selectOne?: boolean;
  printQuery?: boolean;
  initialIndex?: number;
  selectionPrefix?: string;
  initialFilter?: 'IgnoreCase' | 'CaseSensitive' | 'SmartCase' | 'Regexp' | 'Fuzzy';
  layout?: 'bottom-up' | 'top-down';
}

/**
 * Invoke peco prompt as promise, resolve selected items.
 *
 * @params candidates - Candidate items.
 * @params option - `peco` commandline option and promise actions.
 */
export const peco = async (
  candidates: string[],
  option: PecoOption = { onCancel: 'skip', onError: 'reject' }
): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    const peco = spawn(getBinary(option), getOptions(option));

    let selected = '';
    peco.stdout.on('data', data => {
      selected += data;
    });

    peco.stdout.on('end', () => {
      const result = selected
        .trim()
        .split('\n')
        .filter(s => s.length);

      if (result.length === 0 && option.onCancel === 'reject') {
        reject(new Error('canceled'));
      }

      resolve(result);
    });

    peco.on('error', handleError(reject, option));
    peco.stdin.on('error', handleError(reject, option));

    peco.stdin.write(candidates.join('\n'));
    peco.stdin.end();
  });
};
