/**
 * Property categories shown in the site navigation and footer. A category opens /section/<slugify(name)>.
 * These are the launch defaults: the permanent category list is defined in the database schema (Part 2).
 */
export const primaryCategories = [
  "Houses for sale",
  "Apartments for rent",
  "Land for sale",
  "Commercial property",
  "Short stays",
  "New developments",
] as const;

export const moreCategories = [
  "Houses to rent",
  "Apartments for sale",
  "Bedsitters and studios",
  "Student housing",
  "Serviced apartments",
  "Offices",
  "Shops and retail",
  "Warehouses",
  "Farms and ranches",
  "Holiday homes",
] as const;
