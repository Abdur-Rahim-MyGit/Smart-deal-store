import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Category } from "@/lib/types";
import catMakeup from "@/assets/cat-makeup.jpg";
import catSkincare from "@/assets/cat-skincare.jpg";
import catHaircare from "@/assets/cat-haircare.jpg";
import catPerfume from "@/assets/cat-perfume.jpg";
import catElectronics from "@/assets/cat-electronics.jpg";
import catFashion from "@/assets/cat-fashion.jpg";
import catHome from "@/assets/cat-home.jpg";
import catWellness from "@/assets/cat-wellness.jpg";

const LOCAL_CATEGORY_IMAGES: Record<string, string> = {
  makeup: catMakeup,
  skincare: catSkincare,
  haircare: catHaircare,
  perfume: catPerfume,
  electronics: catElectronics,
  fashion: catFashion,
  home: catHome,
  wellness: catWellness,
};

/** Categories nest up to three levels: Category → Subcategory → Sub-subcategory. */
export const MAX_CATEGORY_DEPTH = 3;

export interface CategoryNode extends Category {
  children: CategoryNode[];
}

export function buildCategoryTree(categories: Category[]): CategoryNode[] {
  const nodeFor = (category: Category, depth: number): CategoryNode => ({
    ...category,
    children:
      depth < MAX_CATEGORY_DEPTH
        ? categories
            .filter((child) => child.parentCategory === category._id)
            .map((child) => nodeFor(child, depth + 1))
        : [],
  });
  return categories.filter((category) => !category.parentCategory).map((root) => nodeFor(root, 1));
}

/** Every category below the given node, depth-first, with its level under the node (1 = direct child). */
export function flattenDescendants(
  node: Pick<CategoryNode, "children">,
): { category: CategoryNode; depth: number }[] {
  return node.children.flatMap((child) => [
    { category: child, depth: 1 },
    ...flattenDescendants(child).map((entry) => ({ ...entry, depth: entry.depth + 1 })),
  ]);
}

/** The category and those above it, top level first. */
export function categoryAncestors(
  categories: Category[],
  id: string | null | undefined,
): Category[] {
  const byId = new Map(categories.map((category) => [category._id, category]));
  const path: Category[] = [];
  for (let current = id ? byId.get(id) : undefined; current;) {
    if (path.includes(current)) break;
    path.unshift(current);
    current = current.parentCategory ? byId.get(current.parentCategory) : undefined;
  }
  return path;
}

/** Storefront tile image: admin-uploaded image first, then the bundled artwork. */
export function categoryImage(category: Pick<Category, "slug" | "image">): string {
  return category.image || LOCAL_CATEGORY_IMAGES[category.slug.split("-")[0] ?? ""] || catHome;
}

export function useCategories() {
  const query = useQuery({
    queryKey: ["categories"],
    queryFn: () =>
      api<{ categories: Category[] }>("/products/categories").then(
        (response) => response.categories,
      ),
    staleTime: 5 * 60 * 1000,
  });
  const categories = useMemo(() => query.data ?? [], [query.data]);
  const tree = useMemo(() => buildCategoryTree(categories), [categories]);
  const bySlug = useMemo(
    () => new Map(categories.map((category) => [category.slug, category])),
    [categories],
  );
  return { ...query, categories, tree, bySlug };
}
