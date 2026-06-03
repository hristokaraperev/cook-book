export const CURRENT_RECIPE_DOCUMENT_TEMPLATE_VERSION = 1

export function hasCurrentGeneratedRecipeDocument(recipe) {
  return Boolean(
    recipe?.driveDocUrl &&
      recipe.documentTemplateVersion === CURRENT_RECIPE_DOCUMENT_TEMPLATE_VERSION
  )
}

export function isIncompleteSave(recipe) {
  return !hasCurrentGeneratedRecipeDocument(recipe)
}

export function getRecipeDocumentStatus(recipe) {
  if (!recipe?.driveDocUrl) {
    return {
      status: 'incomplete-save',
      label: 'Incomplete Save',
      message: 'Generated Recipe Document is missing. Open the recipe editor and retry the save.',
    }
  }

  if (recipe.documentTemplateVersion !== CURRENT_RECIPE_DOCUMENT_TEMPLATE_VERSION) {
    return {
      status: 'document-outdated',
      label: 'Document Outdated',
      message: 'Generated Recipe Document needs to be refreshed before sharing.',
    }
  }

  return {
    status: 'ready',
    label: 'Ready',
    message: null,
  }
}
