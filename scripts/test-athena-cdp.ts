#!/usr/bin/env npx tsx
/**
 * MVP Test Script - Connect to Athena Browser
 *
 * Connects to the running Athena Browser via CDP (port 9223)
 * and performs basic read/action operations.
 *
 * Prerequisites:
 *   - Athena browser running with CDP on port 9223
 *
 * Run: npx tsx scripts/test-athena-cdp.ts
 */

import CDP from 'chrome-remote-interface';

async function main() {
  const CDP_PORT = Number(process.env.CEF_BRIDGE_PORT ?? 9223);
  const CDP_HOST = process.env.CEF_BRIDGE_HOST ?? '127.0.0.1';

  console.log(`🔌 Connecting to Athena Browser CDP at ${CDP_HOST}:${CDP_PORT}...`);

  let client: CDP.Client | null = null;

  try {
    // Connect to the running browser
    client = await CDP({ host: CDP_HOST, port: CDP_PORT });
    console.log('✅ Connected!\n');

    const { Page, DOM, Runtime, Input, Accessibility } = client;

    // Enable required domains
    await Page.enable();
    await DOM.enable();
    await Runtime.enable();

    // --- Read page info ---
    console.log('📖 Page Info:');
    const { frameTree } = await Page.getFrameTree();
    console.log(`   URL: ${frameTree.frame.url}`);
    console.log(`   Title: ${frameTree.frame.name || '(no title)'}`);

    // Get document
    const { root } = await DOM.getDocument({ depth: -1 });
    console.log(`   Document nodeId: ${root.nodeId}`);

    // Count elements
    const allNodes = await DOM.querySelectorAll({
      nodeId: root.nodeId,
      selector: '*',
    });
    console.log(`   Total elements: ${allNodes.nodeIds.length}`);

    // --- Find interactive elements ---
    console.log('\n🔍 Interactive Elements:');

    const interactiveSelectors = ['a', 'button', 'input', 'textarea', 'select', '[role="button"]'];

    for (const selector of interactiveSelectors) {
      try {
        const { nodeIds } = await DOM.querySelectorAll({
          nodeId: root.nodeId,
          selector,
        });
        if (nodeIds.length > 0) {
          console.log(`   ${selector}: ${nodeIds.length} found`);
        }
      } catch {
        // Selector might not match anything
      }
    }

    // --- Read first link details ---
    console.log('\n🔗 First Link Details:');
    try {
      const { nodeId: linkNodeId } = await DOM.querySelector({
        nodeId: root.nodeId,
        selector: 'a[href]',
      });

      if (linkNodeId) {
        const { outerHTML } = await DOM.getOuterHTML({ nodeId: linkNodeId });
        const truncated = outerHTML.slice(0, 200) + (outerHTML.length > 200 ? '...' : '');
        console.log(`   HTML: ${truncated}`);

        // Get bounding box
        try {
          const { model } = await DOM.getBoxModel({ nodeId: linkNodeId });
          const [x1, y1, x2, , , , , y4] = model.content;
          console.log(
            `   Position: (${x1.toFixed(0)}, ${y1.toFixed(0)}) to (${x2.toFixed(0)}, ${y4.toFixed(0)})`
          );
        } catch {
          console.log('   Position: (not visible)');
        }
      }
    } catch {
      console.log('   No links found');
    }

    // --- Read accessibility tree sample ---
    console.log('\n♿ Accessibility Tree Sample:');
    try {
      await Accessibility.enable();
      const { nodes } = await Accessibility.getFullAXTree({});

      const interactiveRoles = ['link', 'button', 'textbox', 'checkbox', 'menuitem', 'tab'];
      const interactiveNodes = nodes.filter((n: { role?: { value: string } }) =>
        interactiveRoles.includes(n.role?.value ?? '')
      );

      console.log(`   Total AX nodes: ${nodes.length}`);
      console.log(`   Interactive AX nodes: ${interactiveNodes.length}`);

      console.log('\n   Sample interactive elements:');
      interactiveNodes
        .slice(0, 8)
        .forEach((n: { role?: { value: string }; name?: { value: string } }) => {
          const role = n.role?.value ?? 'unknown';
          const name = n.name?.value ?? '(no name)';
          console.log(`     • ${role}: "${name.slice(0, 50)}${name.length > 50 ? '...' : ''}"`);
        });
    } catch (e) {
      console.log(`   AX tree not available: ${e}`);
    }

    // --- Execute JavaScript ---
    console.log('\n📜 Execute JS:');
    const { result } = await Runtime.evaluate({
      expression: 'document.title',
      returnByValue: true,
    });
    console.log(`   document.title = "${result.value}"`);

    // --- Optional: Perform a click ---
    const doClick = process.argv.includes('--click');
    if (doClick) {
      console.log('\n🖱️  Performing click on first link...');
      try {
        const { nodeId: linkNodeId } = await DOM.querySelector({
          nodeId: root.nodeId,
          selector: 'a[href]',
        });

        if (linkNodeId) {
          const { model } = await DOM.getBoxModel({ nodeId: linkNodeId });
          const [x1, y1, x2, , , , , y4] = model.content;
          const centerX = (x1 + x2) / 2;
          const centerY = (y1 + y4) / 2;

          await Input.dispatchMouseEvent({
            type: 'mousePressed',
            x: centerX,
            y: centerY,
            button: 'left',
            clickCount: 1,
          });
          await Input.dispatchMouseEvent({
            type: 'mouseReleased',
            x: centerX,
            y: centerY,
            button: 'left',
            clickCount: 1,
          });

          console.log(`   Clicked at (${centerX.toFixed(0)}, ${centerY.toFixed(0)})`);

          // Wait and check new URL
          await new Promise((r) => setTimeout(r, 1000));
          const { frameTree: newFrame } = await Page.getFrameTree();
          console.log(`   New URL: ${newFrame.frame.url}`);
        }
      } catch (e) {
        console.log(`   Click failed: ${e}`);
      }
    } else {
      console.log('\n💡 Tip: Run with --click to test clicking the first link');
    }

    console.log('\n✅ MVP test complete!');
  } catch (error) {
    console.error('❌ Error:', error);
    console.log('\n💡 Make sure Athena Browser is running with CDP enabled on port 9223');
  } finally {
    if (client) {
      await client.close();
      console.log('🔌 Disconnected from CDP');
    }
  }
}

main();
