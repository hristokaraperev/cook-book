import { create } from 'zustand'

export const useRecipeStore = create((set) => ({
  recipes: [],
  currentRecipe: null,
  cookbookFolderId: null,
  loading: false,
  error: null,

  setRecipes: (recipes) => set({ recipes }),

  setCurrentRecipe: (recipe) => set({ currentRecipe: recipe }),

  setCookbookFolderId: (id) => set({ cookbookFolderId: id }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),

  addRecipe: (recipe) =>
    set((state) => ({ recipes: [recipe, ...state.recipes] })),

  updateRecipeById: (id, updated) =>
    set((state) => ({
      recipes: state.recipes.map((r) => (r.id === id ? { ...r, ...updated } : r)),
      currentRecipe:
        state.currentRecipe?.id === id
          ? { ...state.currentRecipe, ...updated }
          : state.currentRecipe,
    })),

  removeRecipe: (id) =>
    set((state) => ({
      recipes: state.recipes.filter((r) => r.id !== id),
      currentRecipe: state.currentRecipe?.id === id ? null : state.currentRecipe,
    })),
}))
