import * as tmp from 'tmp';
import * as fs from 'fs-extra';
import * as execa from 'execa';
import * as path from 'path';
import { URL } from 'url';

type Tab = {
  id: string;
  url: string;
  title: string;
};

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

// [1234] ........ => '1234'
function ids(tabs: string): string[] {
  return tabs.split('\n').reduce((acc: string[], n: string) => {
    const parsed = /^\[(\d+?)\]/.exec(n.trim());
    if (parsed) {
      acc.push(parsed[1]);
    }
    return acc;
  }, []);
}

// ......... (1234) => '1234'
function idsFromLast(tabs: string): string[] {
  return tabs.split('\n').reduce((acc: string[], n: string) => {
    const parsed = /\((\d+?)\)$/.exec(n.trim());
    if (parsed) {
      acc.push(parsed[1]);
    }
    return acc;
  }, []);
}

function printHelp() {
  console.log(`See https://github.com/minidonut/close-tab#Usage`);
}

async function findTab(tabId: string): Promise<Tab> {
  const { stdout } = await execa(chromeCli, ['info', '-t', tabId]);
  const [id, title, url] = stdout.split('\n').map(parse);
  return {
    id,
    title,
    url,
  };

  function parse(line: string) {
    const parsed = /^.*?:\s(.*)$/.exec(line);
    if (parsed == null) {
      throw new Error(`Parse error: ${line}`);
    }
    return parsed[1].trim();
  }
}

function printTabs(tabs: Tab[]): string {
  return tabs.map(format).sort().join('\n');

  function format(tab: Tab): string {
    return `[${domainOf(tab.url)}] ${tab.title.slice(0, 140)} (${tab.id})`;
  }

  function domainOf(url: string) {
    return new URL(url).host;
  }
}

async function main(command?: string) {
  if (command == null) {
    const { stdout: rawList } = await execa(chromeCli, ['list', 'tabs']);
    const currentIds = ids(rawList);
    const currentTabs = await Promise.all(currentIds.map(findTab));
    const original = printTabs(currentTabs);

    const filtered = await vimPrompt(original);

    if (filtered.trim() === original.trim()) {
      console.log('aborted. 👋');
      process.exit(0);
    }

    const remainedIds = idsFromLast(filtered);
    const toBeDeletedTabs = currentTabs.filter(tab => !remainedIds.includes(tab.id));

    for (const tab of toBeDeletedTabs) {
      console.log(`${tab.title}\n${tab.url}\n`);
      await execa(chromeCli, ['close', '-t', tab.id]);
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
