const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = process.cwd();
const PAGES = ['/', '/about.html', '/services.html', '/work.html', '/our-story.html'];
const REQUIRED_SELECTORS = {
  '/': ['header#header', '.section--hero', '.section--footer', 'nav#floatingNav', '#floatingInquiry', '#scrollBtn'],
  '/about.html': ['header#header', '.section--about-hero', '.section--footer', 'nav#floatingNav', '#floatingInquiry', '#scrollBtn'],
  '/services.html': ['header#header', '.section--services-hero', '.section--footer', 'nav#floatingNav', '#floatingInquiry', '#scrollBtn'],
  '/work.html': ['header#header', '.section--work-hero', '.section--footer', 'nav#floatingNav', '#floatingInquiry', '#scrollBtn'],
  '/our-story.html': ['header#header', '.section--about-hero', '.section--about-story', '.section--footer', 'nav#floatingNav', '#floatingInquiry', '#scrollBtn']
};

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8'
};

function isSafePath(filePath) {
  const relative = path.relative(ROOT, filePath);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function serveStatic(req, res) {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const requested = urlPath === '/' ? '/index.html' : urlPath;
  const absolute = path.resolve(ROOT, '.' + requested);

  if (!isSafePath(absolute)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  let filePath = absolute;
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const type = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  });
}

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer(serveStatic);
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function stopServer(server) {
  return new Promise((resolve) => server.close(() => resolve()));
}

function isExternalUrl(value) {
  return /^(https?:)?\/\//i.test(value) || /^(mailto:|tel:|javascript:|data:|#)/i.test(value);
}

async function collectLocalAssetPaths(page, pageUrl) {
  return page.evaluate((currentPageUrl) => {
    const out = [];
    const attrs = ['src', 'href', 'poster'];
    const base = new URL(currentPageUrl);

    document.querySelectorAll('[src], [href], [poster]').forEach((el) => {
      attrs.forEach((attr) => {
        const raw = el.getAttribute(attr);
        if (!raw) return;
        out.push(raw.trim());
      });
    });

    return out
      .filter(Boolean)
      .filter((raw) => !/^(https?:)?\/\//i.test(raw))
      .filter((raw) => !/^(mailto:|tel:|javascript:|data:|#)/i.test(raw))
      .map((raw) => {
        try {
          return new URL(raw, base).pathname;
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  }, pageUrl);
}

function installAnimationMocks() {
  return `
    (() => {
      const makeTween = () => ({
        to: () => makeTween(),
        fromTo: () => makeTween(),
        set: () => makeTween(),
        add: () => makeTween()
      });

      const gsapMock = {
        registerPlugin: () => {},
        timeline: () => makeTween(),
        to: () => makeTween(),
        fromTo: () => makeTween(),
        set: () => makeTween(),
        ticker: {
          add: () => {},
          lagSmoothing: () => {}
        },
        globalTimeline: {
          timeScale: () => {}
        }
      };

      const scrollTriggerMock = {
        create: () => ({ kill: () => {} }),
        update: () => {},
        refresh: () => {}
      };

      function LenisMock() {}
      LenisMock.prototype.on = () => {};
      LenisMock.prototype.scrollTo = () => {};
      LenisMock.prototype.raf = () => {};

      window.gsap = window.gsap || gsapMock;
      window.ScrollTrigger = window.ScrollTrigger || scrollTriggerMock;
      window.Draggable = window.Draggable || {};
      window.Lenis = window.Lenis || LenisMock;
    })();
  `;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runStaticChecks(browser, baseUrl, failures) {
  for (const route of PAGES) {
    const page = await browser.newPage();
    await page.setJavaScriptEnabled(false);
    const url = `${baseUrl}${route}`;
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    if (!response || response.status() >= 400) {
      failures.push(`${route}: returned HTTP ${response ? response.status() : 'NO_RESPONSE'}`);
      await page.close();
      continue;
    }

    const assetPaths = await collectLocalAssetPaths(page, url);
    for (const assetPath of assetPaths) {
      if (isExternalUrl(assetPath)) continue;
      const absolutePath = path.resolve(ROOT, '.' + assetPath);
      if (!isSafePath(absolutePath) || !fs.existsSync(absolutePath)) {
        failures.push(`${route}: missing local asset ${assetPath}`);
      }
    }

    await page.close();
  }
}

async function runStructureChecks(browser, baseUrl, failures) {
  for (const route of PAGES) {
    const page = await browser.newPage();
    await page.setJavaScriptEnabled(false);
    const url = `${baseUrl}${route}`;
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    if (!response || response.status() >= 400) {
      failures.push(`${route}: structure check returned HTTP ${response ? response.status() : 'NO_RESPONSE'}`);
      await page.close();
      continue;
    }

    const selectors = REQUIRED_SELECTORS[route] || [];
    const result = await page.evaluate((requiredSelectors) => {
      const missingSelectors = requiredSelectors.filter((selector) => !document.querySelector(selector));
      const title = document.querySelector('title')?.textContent?.trim() || '';
      const canonicalHref = document.querySelector('link[rel="canonical"]')?.getAttribute('href') || '';
      const ogUrl = document.querySelector('meta[property="og:url"]')?.getAttribute('content') || '';
      const insecureBlankTargets = Array.from(document.querySelectorAll('a[target="_blank"]'))
        .filter((anchor) => {
          const rel = anchor.getAttribute('rel') || '';
          const relTokens = rel.toLowerCase().split(/\s+/).filter(Boolean);
          return !(relTokens.includes('noopener') && relTokens.includes('noreferrer'));
        })
        .map((anchor) => anchor.getAttribute('href') || '(missing href)');

      return {
        missingSelectors,
        hasTitle: title.length > 0,
        hasCanonical: canonicalHref.length > 0,
        hasOgUrl: ogUrl.length > 0,
        insecureBlankTargets
      };
    }, selectors);

    if (result.missingSelectors.length) {
      failures.push(`${route}: missing critical selectors ${result.missingSelectors.join(', ')}`);
    }
    if (!result.hasTitle) {
      failures.push(`${route}: missing or empty <title>`);
    }
    if (!result.hasCanonical) {
      failures.push(`${route}: missing canonical link`);
    }
    if (!result.hasOgUrl) {
      failures.push(`${route}: missing og:url meta`);
    }
    if (result.insecureBlankTargets.length) {
      failures.push(`${route}: target="_blank" missing rel="noopener noreferrer" for ${result.insecureBlankTargets.join(', ')}`);
    }

    await page.close();
  }
}

async function runRuntimeChecks(browser, baseUrl, failures) {
  for (const route of PAGES) {
    const page = await browser.newPage();
    const pageErrors = [];
    const consoleErrors = [];

    await page.evaluateOnNewDocument(installAnimationMocks());
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const requestUrl = request.url();
      if (/^https?:\/\//i.test(requestUrl) && !requestUrl.startsWith(baseUrl)) {
        request.abort('blockedbyclient');
        return;
      }
      request.continue();
    });

    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });

    page.on('console', (message) => {
      if (message.type() === 'error') {
        const text = message.text();
        if (
          !text.includes('Failed to load resource') &&
          !text.includes('net::ERR_BLOCKED_BY_CLIENT')
        ) {
          consoleErrors.push(text);
        }
      }
    });

    const url = `${baseUrl}${route}`;
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (!response || response.status() >= 400) {
      failures.push(`${route}: runtime check returned HTTP ${response ? response.status() : 'NO_RESPONSE'}`);
      await page.close();
      continue;
    }

    await wait(300);
    if (pageErrors.length) {
      failures.push(`${route}: pageerror ${pageErrors[0]}`);
    }
    if (consoleErrors.length) {
      failures.push(`${route}: console error ${consoleErrors[0]}`);
    }

    await page.close();
  }
}

async function run() {
  let server;
  let browser;

  try {
    server = await startServer();
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;

    browser = await puppeteer.launch({ headless: 'new' });
    const failures = [];
    await runStaticChecks(browser, baseUrl, failures);
    await runStructureChecks(browser, baseUrl, failures);
    await runRuntimeChecks(browser, baseUrl, failures);

    if (failures.length) {
      console.error('Smoke test failed with the following issues:');
      failures.forEach((entry) => console.error(`- ${entry}`));
      process.exitCode = 1;
      return;
    }

    console.log(`Smoke test passed for ${PAGES.length} pages (static + runtime checks).`);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    if (browser) {
      await browser.close();
    }
    if (server) {
      await stopServer(server);
    }
  }
}

run();
