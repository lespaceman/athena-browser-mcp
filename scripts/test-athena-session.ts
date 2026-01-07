#!/usr/bin/env npx tsx
/**
 * MVP Test Script - SessionManager + Athena Browser
 *
 * Uses SessionManager.connect() to connect to Athena Browser via CDP,
 * then uses PlaywrightCdpClient for operations.
 *
 * Prerequisites:
 *   - Athena browser running with CDP on port 9223
 *
 * Run: npx tsx scripts/test-athena-session.ts
 */

import { SessionManager } from '../src/browser/session-manager.js';

async function main() {
  const session = new SessionManager();

  try {
    // Connect to Athena Browser
    console.log('🔌 Connecting to Athena Browser...');
    await session.connect(); // Uses default port 9223
    console.log('✅ Connected!\n');

    // Adopt the existing page
    console.log('📄 Adopting existing page...');
    const handle = await session.adoptPage(0);
    console.log(`   Page ID: ${handle.page_id}`);
    console.log(`   URL: ${handle.page.url()}`);

    // --- Read page via Playwright ---
    console.log('\n📖 Page Info (Playwright):');
    const title = await handle.page.title();
    console.log(`   Title: ${title}`);

    // --- Read DOM via CDP (using PlaywrightCdpClient) ---
    console.log('\n🔍 Reading DOM via PlaywrightCdpClient...');
    const doc = await handle.cdp.send<{ root: { nodeId: number } }>('DOM.getDocument', {
      depth: 2,
    });
    console.log(`   Document nodeId: ${doc.root.nodeId}`);

    // Count elements
    const allNodes = await handle.cdp.send<{ nodeIds: number[] }>('DOM.querySelectorAll', {
      nodeId: doc.root.nodeId,
      selector: '*',
    });
    console.log(`   Total elements: ${allNodes.nodeIds.length}`);

    // Find interactive elements
    const links = await handle.cdp.send<{ nodeIds: number[] }>('DOM.querySelectorAll', {
      nodeId: doc.root.nodeId,
      selector: 'a',
    });
    const buttons = await handle.cdp.send<{ nodeIds: number[] }>('DOM.querySelectorAll', {
      nodeId: doc.root.nodeId,
      selector: 'button',
    });
    const inputs = await handle.cdp.send<{ nodeIds: number[] }>('DOM.querySelectorAll', {
      nodeId: doc.root.nodeId,
      selector: 'input',
    });
    console.log(`   Links: ${links.nodeIds.length}`);
    console.log(`   Buttons: ${buttons.nodeIds.length}`);
    console.log(`   Inputs: ${inputs.nodeIds.length}`);

    // --- Read Accessibility Tree ---
    console.log('\n♿ Accessibility Tree:');
    const axTree = await handle.cdp.send<{
      nodes: Array<{ role?: { value: string }; name?: { value: string } }>;
    }>('Accessibility.getFullAXTree', {});

    const interactiveRoles = ['link', 'button', 'textbox', 'checkbox', 'menuitem'];
    const interactiveNodes = axTree.nodes.filter((n) =>
      interactiveRoles.includes(n.role?.value ?? '')
    );
    console.log(`   Total AX nodes: ${axTree.nodes.length}`);
    console.log(`   Interactive nodes: ${interactiveNodes.length}`);

    console.log('\n   Sample elements:');
    interactiveNodes.slice(0, 6).forEach((n) => {
      const role = n.role?.value ?? 'unknown';
      const name = n.name?.value ?? '(no name)';
      console.log(`     • ${role}: "${name.slice(0, 50)}"`);
    });

    // --- Perform a click (optional) ---
    if (process.argv.includes('--click')) {
      console.log('\n🖱️  Clicking first link...');
      if (links.nodeIds.length > 0) {
        const boxModel = await handle.cdp.send<{ model: { content: number[] } }>(
          'DOM.getBoxModel',
          {
            nodeId: links.nodeIds[0],
          }
        );
        const [x1, y1, x2, , , , , y4] = boxModel.model.content;
        const centerX = (x1 + x2) / 2;
        const centerY = (y1 + y4) / 2;

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

        console.log(`   Clicked at (${centerX.toFixed(0)}, ${centerY.toFixed(0)})`);
        await new Promise((r) => setTimeout(r, 1000));
        console.log(`   New URL: ${handle.page.url()}`);
      }
    } else {
      console.log('\n💡 Tip: Run with --click to test clicking');
    }

    console.log('\n✅ MVP test complete!');
  } catch (error) {
    console.error('❌ Error:', error);
    console.log('\n💡 Make sure Athena Browser is running with CDP enabled on port 9223');
  } finally {
    await session.shutdown();
    console.log('👋 Disconnected (Athena browser still running)');
  }
}

main();
