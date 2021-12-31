import * as tmp from 'tmp';
import * as fs from 'fs-extra';
import * as execa from 'execa';
import * as path from 'path';

const chromeCli = path.join(__dirname, '../bin/chrome-cli');

async function vimPrompt(text: string): Promise<string> {
  const { name, removeCallback } = tmp.fileSync({ postfix: '.tmp' });
  try {
    await fs.writeFile(name, text, { encoding: 'utf-8' });
    await execa('vi', [name], { stdio: 'inherit' });
    return await fs.readFile(name, 'utf-8');
  } finally {
    removeCallback();
  }
}

function ids(tabs: string): string[] {
  return tabs.split('\n').reduce((acc: string[], n: string) => {
    const parsed = /^\[(\d+?)\]/.exec(n.trim());
    if (parsed) {
      acc.push(parsed[1]);
    }
    return acc;
  }, []);
}

function printHelp() {
  console.log(`See https://github.com/minidonut/close-tab#Usage`);
}

async function main(command?: string) {
  if (command == null) {
    const { stdout: original } = await execa(chromeCli, ['list', 'tabs']);
    const filtered = await vimPrompt(original);

    if (filtered === original) {
      console.log('aborted. 👋');
    }

    const remainedIds = ids(filtered);
    const toBeDeletedIds = ids(original).filter(id => !remainedIds.includes(id));

    for (const id of toBeDeletedIds) {
      await execa(chromeCli, ['info', '-t', id], { stdio: 'inherit' });
      await execa(chromeCli, ['close', '-t', id]);
    }
  } else if (['version', '--version', '-v'].includes(command)) {
    const pkgJson = await fs.readJson(path.join(__dirname, '..', 'package.json'));
    console.log(pkgJson.version);
  } else if (['help', '--help', '-h'].includes(command)) {
    printHelp();
  } else {
    console.error(`Unknown command: ${command}`);
  }
}

main(process.argv[2]);
