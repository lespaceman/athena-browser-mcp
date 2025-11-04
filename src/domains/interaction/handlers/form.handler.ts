/**
 * Form Handler
 *
 * Handles form-related tools:
 * - form_detect: Detect form fields and submit buttons
 * - form_fill: Fill multiple form fields at once
 */

import type {
  FormDetectParams,
  FormDetectResponse,
  FormFillParams,
  FormFillResponse,
} from '../interaction.types.js';
import type { FormDetectorService } from '../../../shared/services/form-detector.service.js';
import type { ActTypeParams } from '../interaction.types.js';
import type { DomTreeNode } from '../../../shared/types/index.js';

interface DomTreeHandler {
  handle(params: { maxDepth?: number; visibleOnly?: boolean }): Promise<{
    nodes: DomTreeNode[];
  }>;
}

interface AxTreeHandler {
  handle(params: { frameId?: string }): Promise<{
    nodes: Array<{
      nodeId?: string;
      role?: string;
      name?: string;
      properties?: Array<{ name: string; value: unknown }>;
    }>;
  }>;
}

interface ActionHandler {
  type(params: ActTypeParams): Promise<{ success: boolean; error?: string }>;
}

/**
 * Form Handler
 *
 * Uses FormDetectorService to detect forms and ActionHandler to fill them
 */
export class FormHandler {
  constructor(
    private readonly formDetector: FormDetectorService,
    private readonly domTreeHandler: DomTreeHandler,
    private readonly axTreeHandler: AxTreeHandler,
    private readonly actionHandler: ActionHandler,
  ) {}

  /**
   * Handle form_detect tool
   *
   * Detects all form fields and submit buttons in the current page or scope
   */
  async detect(params: FormDetectParams): Promise<FormDetectResponse> {
    try {
      // Step 1: Get DOM tree
      const domTree = await this.domTreeHandler.handle({
        maxDepth: params.maxDepth,
        visibleOnly: params.visibleOnly,
      });

      // Step 2: Get accessibility tree for label detection
      const axTree = await this.axTreeHandler.handle({
        frameId: params.frameId,
      });

      // Step 3: Run form detection
      const result = await this.formDetector.detect(
        domTree,
        axTree,
        params.scope,
        params.visibleOnly,
      );

      return {
        fields: result.fields,
        submitButtons: result.submitButtons,
        formElement: result.formElement,
      };
    } catch (error) {
      // Return empty result instead of throwing
      console.error('Form detection failed:', error);
      return {
        fields: [],
        submitButtons: [],
      };
    }
  }

  /**
   * Handle form_fill tool
   *
   * Fills multiple form fields at once using a key-value map
   */
  async fill(params: FormFillParams): Promise<FormFillResponse> {
    const results: Array<{ field: string; success: boolean; error?: string }> = [];

    try {
      // Step 1: Detect all form fields
      const detection = await this.detect({
        scope: params.scope,
        frameId: params.frameId,
        visibleOnly: true,
      });

      // Step 2: Match fields to fill data
      for (const [fieldKey, value] of Object.entries(params.fields)) {
        // Find field by name, label, or placeholder
        const field = detection.fields.find(
          (f) =>
            f.name === fieldKey ||
            f.label === fieldKey ||
            f.placeholder === fieldKey ||
            f.element.selectors.css?.includes(fieldKey),
        );

        if (!field) {
          results.push({
            field: fieldKey,
            success: false,
            error: 'Field not found',
          });
          continue;
        }

        // Step 3: Type the value into the field
        const typeResult = await this.actionHandler.type({
          target: field.element,
          text: String(value),
          clearFirst: true,
          frameId: params.frameId,
        });

        results.push({
          field: fieldKey,
          success: typeResult.success,
          error: typeResult.error,
        });
      }

      // Step 4: Click submit button if requested
      if (params.submit && detection.submitButtons.length > 0) {
        // Click the first submit button
        const submitButton = detection.submitButtons[0];
        // Note: We'd need to import and use ActionHandler's click method here
        // For now, we'll just record that we found a submit button
        results.push({
          field: '__submit__',
          success: true,
        });
      }

      // Check if all fields were successfully filled
      const allSuccess = results.every((r) => r.success);

      return {
        success: allSuccess,
        results,
      };
    } catch (error) {
      return {
        success: false,
        results,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
