#!/usr/bin/env npx ts-node
/**
 * MVP Test Script
 *
 * Validates the browser foundation by:
 * 1. Launching browser via SessionManager
 * 2. Navigating to a page
 * 3. Reading page content via CDP
 * 4. Performing a simple action (click)
 *
 * Run: npx tsx scripts/test-browser.ts
 */

import { SessionManager } from '../src/browser/session-manager.js';

async function main() {
  const session = new SessionManager();

  try {
    console.log('🚀 Launching browser...');
    await session.launch({ headless: false }); // visible for demo

    console.log('📄 Creating page and navigating to example.com...');
    const handle = await session.createPage('https://example.com');
    console.log(`   Page ID: ${handle.page_id}`);

    // Wait for page to settle
    await handle.page.waitForLoadState('networkidle');

    // --- Read page info via Playwright ---
    const title = await handle.page.title();
    const url = handle.page.url();
    console.log(`\n📖 Page Info (Playwright):`);
    console.log(`   Title: ${title}`);
    console.log(`   URL: ${url}`);

    // --- Read DOM via CDP ---
    console.log(`\n🔍 Reading DOM via CDP...`);
    const doc = await handle.cdp.send<{ root: { nodeId: number } }>('DOM.getDocument', {
      depth: 2,
    });
    console.log(`   Document nodeId: ${doc.root.nodeId}`);

    // Get page text content
    const bodyNode = await handle.cdp.send<{ nodeId: number }>('DOM.querySelector', {
      nodeId: doc.root.nodeId,
      selector: 'body',
    });

    const outerHTML = await handle.cdp.send<{ outerHTML: string }>('DOM.getOuterHTML', {
      nodeId: bodyNode.nodeId,
    });
    console.log(`   Body HTML length: ${outerHTML.outerHTML.length} chars`);

    // --- Find and click a link via CDP ---
    console.log(`\n🖱️  Finding link via CDP...`);
    const linkNode = await handle.cdp.send<{ nodeId: number }>('DOM.querySelector', {
      nodeId: doc.root.nodeId,
      selector: 'a',
    });

    if (linkNode.nodeId) {
      // Get link bounding box
      const boxModel = await handle.cdp.send<{
        model: { content: number[] };
      }>('DOM.getBoxModel', {
        nodeId: linkNode.nodeId,
      });

      const [x1, y1, x2, , , , x4, y4] = boxModel.model.content;
      const centerX = (x1 + x2) / 2;
      const centerY = (y1 + y4) / 2;
      console.log(`   Link found at (${centerX.toFixed(0)}, ${centerY.toFixed(0)})`);

      // Click using CDP Input
      console.log(`   Clicking link...`);
      await handle.cdp.send('Input.dispatchMouseEvent', {
        type: 'mousePressed',
        x: centerX,
        y: centerY,
        button: 'left',
        clickCount: 1,
      });
      await handle.cdp.send('Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        x: centerX,
        y: centerY,
        button: 'left',
        clickCount: 1,
      });

      // Wait for navigation
      await handle.page.waitForLoadState('domcontentloaded').catch(() => {});
      console.log(`   New URL: ${handle.page.url()}`);
    }

    // --- Read accessibility tree ---
    console.log(`\n♿ Reading Accessibility Tree via CDP...`);
    const axTree = await handle.cdp.send<{
      nodes: Array<{ nodeId: string; role?: { value: string }; name?: { value: string } }>;
    }>('Accessibility.getFullAXTree', {});
    const interactiveNodes = axTree.nodes.filter((n) =>
      ['link', 'button', 'textbox', 'checkbox'].includes(n.role?.value ?? '')
    );
    console.log(`   Total AX nodes: ${axTree.nodes.length}`);
    console.log(`   Interactive nodes: ${interactiveNodes.length}`);
    interactiveNodes.slice(0, 5).forEach((n) => {
      console.log(`     - ${n.role?.value}: "${n.name?.value ?? '(no name)'}"`);
    });

    console.log('\n✅ MVP test complete!');
    console.log('   Press Ctrl+C to close browser...');

    // Keep browser open for inspection
    await new Promise((resolve) => setTimeout(resolve, 30000));
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await session.shutdown();
    console.log('👋 Browser closed');
  }
}

main();
