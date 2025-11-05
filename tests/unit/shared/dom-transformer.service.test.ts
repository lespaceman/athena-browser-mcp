/**
 * Unit tests for DomTransformerService
 */

import { describe, it, expect } from 'vitest';
import { DomTransformerService } from '../../../src/shared/services/dom-transformer.service.js';

const attrsToMap = (attrs?: string[]): Record<string, string> => {
  const result: Record<string, string> = {};
  if (!attrs) return result;
  for (let i = 0; i < attrs.length; i += 2) {
    const key = attrs[i];
    const value = attrs[i + 1];
    if (key) {
      result[key] = value ?? '';
    }
  }
  return result;
};

describe('DomTransformerService', () => {
  const service = new DomTransformerService();

  describe('transform', () => {
    it('should transform a simple CDP DOM tree', () => {
      const cdpResponse = {
        root: {
          nodeId: 1,
          nodeType: 9, // DOCUMENT
          nodeName: '#document',
          localName: '',
          nodeValue: '',
          children: [
            {
              nodeId: 2,
              nodeType: 1, // ELEMENT
              nodeName: 'HTML',
              localName: 'html',
              nodeValue: '',
              attributes: [],
              children: [
                {
                  nodeId: 3,
                  nodeType: 1,
                  nodeName: 'BODY',
                  localName: 'body',
                  nodeValue: '',
                  attributes: [],
                  children: [
                    {
                      nodeId: 4,
                      nodeType: 1,
                      nodeName: 'DIV',
                      localName: 'div',
                      nodeValue: '',
                      attributes: ['id', 'main', 'class', 'container'],
                      children: [
                        {
                          nodeId: 5,
                          nodeType: 3, // TEXT
                          nodeName: '#text',
                          localName: '',
                          nodeValue: 'Hello World',
                          children: [],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      };

      const result = service.transform(cdpResponse, {});

      expect(result.nodes).toBeDefined();
      expect(result.nodes.length).toBeGreaterThan(0);

      // The tree should have html > body > div structure
      const html = result.nodes.find((n) => n.tag === 'html');
      expect(html).toBeDefined();

      // Find the div element (could be nested)
      const div = service.filterByTag(result.nodes, 'div')[0];
      expect(div).toBeDefined();
      const divAttrs = attrsToMap(div?.attrs);
      expect(divAttrs.id).toBe('main');
      expect(divAttrs.class).toBe('container');
    });

    it('should respect depth parameter', () => {
      const cdpResponse = {
        root: {
          nodeId: 1,
          nodeType: 9,
          nodeName: '#document',
          localName: '',
          nodeValue: '',
          children: [
            {
              nodeId: 2,
              nodeType: 1,
              nodeName: 'HTML',
              localName: 'html',
              nodeValue: '',
              attributes: [],
              children: [
                {
                  nodeId: 3,
                  nodeType: 1,
                  nodeName: 'BODY',
                  localName: 'body',
                  nodeValue: '',
                  attributes: [],
                  children: [],
                },
              ],
            },
          ],
        },
      };

      const result = service.transform(cdpResponse, { depth: 0 });

      // With depth 0, should only get the html element
      expect(result.nodes.length).toBe(1);
      expect(result.nodes[0].tag).toBe('html');
    });

    it('should filter hidden elements when visibleOnly is true', () => {
      const cdpResponse = {
        root: {
          nodeId: 1,
          nodeType: 9,
          nodeName: '#document',
          localName: '',
          nodeValue: '',
          children: [
            {
              nodeId: 2,
              nodeType: 1,
              nodeName: 'DIV',
              localName: 'div',
              nodeValue: '',
              attributes: ['style', 'display:none'],
              children: [],
            },
            {
              nodeId: 3,
              nodeType: 1,
              nodeName: 'DIV',
              localName: 'div',
              nodeValue: '',
              attributes: ['style', 'visibility:hidden'],
              children: [],
            },
            {
              nodeId: 4,
              nodeType: 1,
              nodeName: 'DIV',
              localName: 'div',
              nodeValue: '',
              attributes: [],
              children: [],
            },
          ],
        },
      };

      const result = service.transform(cdpResponse, { visibleOnly: true });

      // Only the third div should be included
      expect(result.nodes.length).toBe(1);
      expect(result.nodes[0].id).toBe('node-4');
    });
  });

  describe('flattenTree', () => {
    it('should flatten nested tree structure', () => {
      const nodes = [
        {
          id: 'node-1',
          tag: 'div',
          attrs: [],
          children: [
            {
              id: 'node-2',
              tag: 'span',
              attrs: [],
              children: [
                {
                  id: 'node-3',
                  tag: 'a',
                  attrs: [],
                  children: [],
                },
              ],
            },
          ],
        },
      ];

      const flattened = service.flattenTree(nodes);

      expect(flattened.length).toBe(3);
      expect(flattened[0].tag).toBe('div');
      expect(flattened[1].tag).toBe('span');
      expect(flattened[2].tag).toBe('a');
    });
  });

  describe('filterByTag', () => {
    it('should filter nodes by tag name', () => {
      const nodes = [
        {
          id: 'node-1',
          tag: 'div',
          attrs: [],
          children: [
            {
              id: 'node-2',
              tag: 'button',
              attrs: [],
              children: [],
            },
            {
              id: 'node-3',
              tag: 'input',
              attrs: [],
              children: [],
            },
          ],
        },
        {
          id: 'node-4',
          tag: 'button',
          attrs: [],
          children: [],
        },
      ];

      const buttons = service.filterByTag(nodes, 'button');

      expect(buttons.length).toBe(2);
      expect(buttons[0].id).toBe('node-2');
      expect(buttons[1].id).toBe('node-4');
    });
  });

  describe('findByAttribute', () => {
    it('should find nodes by attribute name', () => {
      const nodes = [
        {
          id: 'node-1',
          tag: 'input',
          attrs: ['type', 'text', 'name', 'username'],
          children: [],
        },
        {
          id: 'node-2',
          tag: 'input',
          attrs: ['type', 'password'],
          children: [],
        },
      ];

      const withName = service.findByAttribute(nodes, 'name');

      expect(withName.length).toBe(1);
      expect(withName[0].id).toBe('node-1');
    });

    it('should find nodes by attribute name and value', () => {
      const nodes = [
        {
          id: 'node-1',
          tag: 'input',
          attrs: ['type', 'text'],
          children: [],
        },
        {
          id: 'node-2',
          tag: 'input',
          attrs: ['type', 'password'],
          children: [],
        },
      ];

      const passwordInputs = service.findByAttribute(nodes, 'type', 'password');

      expect(passwordInputs.length).toBe(1);
      expect(passwordInputs[0].id).toBe('node-2');
    });
  });
});
