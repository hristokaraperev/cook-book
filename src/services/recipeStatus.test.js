import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CURRENT_RECIPE_DOCUMENT_TEMPLATE_VERSION,
  getRecipeDocumentStatus,
  hasCurrentGeneratedRecipeDocument,
  isIncompleteSave,
} from './recipeStatus.js'

test('hasCurrentGeneratedRecipeDocument requires a document URL and the current template version', () => {
  assert.equal(
    hasCurrentGeneratedRecipeDocument({
      driveDocId: 'doc-1',
      driveDocUrl: 'https://docs.google.com/document/d/doc-1/edit',
      documentTemplateVersion: CURRENT_RECIPE_DOCUMENT_TEMPLATE_VERSION,
    }),
    true
  )

  assert.equal(
    hasCurrentGeneratedRecipeDocument({
      driveDocId: 'doc-1',
      driveDocUrl: null,
      documentTemplateVersion: CURRENT_RECIPE_DOCUMENT_TEMPLATE_VERSION,
    }),
    false
  )

  assert.equal(
    hasCurrentGeneratedRecipeDocument({
      driveDocId: 'doc-1',
      driveDocUrl: 'https://docs.google.com/document/d/doc-1/edit',
      documentTemplateVersion: CURRENT_RECIPE_DOCUMENT_TEMPLATE_VERSION - 1,
    }),
    false
  )
})

test('isIncompleteSave identifies recipes that cannot be shared yet', () => {
  assert.equal(isIncompleteSave({ driveDocUrl: null, documentTemplateVersion: 1 }), true)
  assert.equal(isIncompleteSave({ driveDocUrl: 'https://docs.google.com/document/d/doc-1/edit' }), true)
  assert.equal(
    isIncompleteSave({
      driveDocUrl: 'https://docs.google.com/document/d/doc-1/edit',
      documentTemplateVersion: CURRENT_RECIPE_DOCUMENT_TEMPLATE_VERSION,
    }),
    false
  )
})

test('the formatted template version marks plain-text era documents (version 1) as outdated', () => {
  assert.equal(CURRENT_RECIPE_DOCUMENT_TEMPLATE_VERSION, 2)

  const plainTextEra = {
    driveDocUrl: 'https://docs.google.com/document/d/doc-1/edit',
    documentTemplateVersion: 1,
  }
  assert.equal(hasCurrentGeneratedRecipeDocument(plainTextEra), false)
  assert.equal(getRecipeDocumentStatus(plainTextEra).status, 'document-outdated')

  const formattedEra = {
    driveDocUrl: 'https://docs.google.com/document/d/doc-1/edit',
    documentTemplateVersion: CURRENT_RECIPE_DOCUMENT_TEMPLATE_VERSION,
  }
  assert.equal(hasCurrentGeneratedRecipeDocument(formattedEra), true)
  assert.equal(getRecipeDocumentStatus(formattedEra).status, 'ready')
})

test('getRecipeDocumentStatus explains the visible status for warning UI', () => {
  assert.deepEqual(getRecipeDocumentStatus({ driveDocUrl: null, documentTemplateVersion: 1 }), {
    status: 'incomplete-save',
    label: 'Incomplete Save',
    message: 'Generated Recipe Document is missing. Open the recipe editor and retry the save.',
  })

  assert.deepEqual(
    getRecipeDocumentStatus({
      driveDocUrl: 'https://docs.google.com/document/d/doc-1/edit',
      documentTemplateVersion: 0,
    }),
    {
      status: 'document-outdated',
      label: 'Document Outdated',
      message: 'Generated Recipe Document needs to be refreshed before sharing.',
    }
  )

  assert.deepEqual(
    getRecipeDocumentStatus({
      driveDocUrl: 'https://docs.google.com/document/d/doc-1/edit',
      documentTemplateVersion: CURRENT_RECIPE_DOCUMENT_TEMPLATE_VERSION,
    }),
    {
      status: 'ready',
      label: 'Ready',
      message: null,
    }
  )
})
