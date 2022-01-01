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

function findIdsFromRaw(tabs: string): string[] {
  return tabs.split('\n').reduce((acc: string[], n: string) => {
    const parsed = /^\[(\d+?)\]/.exec(n.trim());
    if (parsed) {
      acc.push(parsed[1]);
    }
    return acc;
  }, []);
}

// naive match ids, there is possibility to match wrong ids
function findIds(tabs: string): string[] {
  return (tabs.match(/\(\d+?\)/g) ?? []).map(matched => matched.slice(1, -1));
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
  const grouped = tabs.sort().reduce((map, tab) => {
    const domain = domainOf(tab.url) || 'about:blank';

    if (map.has(domain)) {
      map.get(domain)!.push(tab);
    } else {
      map.set(domain, [tab]);
    }
    return map;
  }, new Map<string, Tab[]>());

  return Array.from(grouped.entries()).map(format).sort().join('\n');

  function format([domain, tabs]: [string, Tab[]]): string {
    return [`[${domain}]`, ...tabs.map(tab => `- ${tab.title.slice(0, 140)} (${tab.id})`), ''].join('\n');
  }

  function domainOf(url: string) {
    return new URL(url).host;
  }
}

async function main(command?: string) {
  if (command == null) {
    const { stdout: rawList } = await execa(chromeCli, ['list', 'tabs']);
    const currentIds = findIdsFromRaw(rawList);
    const currentTabs = await Promise.all(currentIds.map(findTab));
    const original = printTabs(currentTabs);

    const filtered = await vimPrompt(original);

    if (filtered.trim() === original.trim()) {
      console.log('aborted. 👋');
      process.exit(0);
    }

    const remainedIds = findIds(filtered);
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
