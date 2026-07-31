import {
  MdDirectionsCar,
  MdSpa,
  MdMenuBook,
  MdLocalCafe,
  MdCheckroom,
  MdLocalGroceryStore,
  MdFavorite,
  MdKitchen,
  MdPhoneIphone,
  MdCategory,
  MdSportsSoccer,
  MdToys,
  MdOutlineWidgets,
} from 'react-icons/md';
import type { IconType } from 'react-icons';

// One icon + accent color per real seller_categories slug (see
// scraper/migrations/011_create_seller_platform_tables.sql) - gives each
// category card a distinct identity instead of every card looking
// identical regardless of what it actually is.
export const CATEGORY_VISUALS: Record<string, { icon: IconType; color: string }> = {
  automotive: { icon: MdDirectionsCar, color: '#EE5D50' },
  'beauty-and-personal-care': { icon: MdSpa, color: '#FF7AA8' },
  'books-and-stationery': { icon: MdMenuBook, color: '#8B5CF6' },
  'coffee-and-beverages': { icon: MdLocalCafe, color: '#B4732A' },
  'fashion-and-apparel': { icon: MdCheckroom, color: '#F97316' },
  'grocery-and-food': { icon: MdLocalGroceryStore, color: '#05CD99' },
  'health-and-wellness': { icon: MdFavorite, color: '#EC4899' },
  'home-and-kitchen': { icon: MdKitchen, color: '#22D3EE' },
  'mobiles-and-electronics': { icon: MdPhoneIphone, color: '#4318FF' },
  'sports-and-outdoors': { icon: MdSportsSoccer, color: '#16A34A' },
  'toys-and-baby': { icon: MdToys, color: '#FFB547' },
  other: { icon: MdOutlineWidgets, color: '#667085' },
};

export const DEFAULT_CATEGORY_VISUAL = { icon: MdCategory, color: '#667085' };

export function getCategoryVisual(slug: string) {
  return CATEGORY_VISUALS[slug] ?? DEFAULT_CATEGORY_VISUAL;
}
