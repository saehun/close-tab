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

async function main() {
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
}

main();
