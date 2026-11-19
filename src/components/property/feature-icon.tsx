import { Accessibility, ArrowUpDown, Armchair, Bath, BedDouble, Bell, BookOpen, Boxes, BriefcaseBusiness, Building2, Bus, Camera, Car, ChefHat, CircleParking, Church, Container, Dumbbell, DoorOpen, Droplets, Fan, Fence, FireExtinguisher, Flame, Flower2, GraduationCap, Hammer, House, Landmark, Layers, Leaf, Lock, MapPin, Mountain, PawPrint, Phone, Plug, Presentation, Route, ShieldCheck, Shirt, ShoppingBag, Siren, Sofa, Stethoscope, Sun, Sunrise, Toilet, Trees, Trophy, Users, Utensils, WashingMachine, Waves, Wifi, Wind, Zap, type LucideIcon } from "lucide-react";

/** One icon per feature, so a long list is quick to scan on a listing and when creating one. */
const BY_KEY: Record<string, LucideIcon> = {
  gated_community: Lock, security_24h: ShieldCheck, cctv: Camera, electric_fence: Zap, alarm_system: Siren, perimeter_wall: Fence, intercom: Phone,
  borehole: Droplets, piped_water: Droplets, water_tank: Container, backup_generator: Plug, solar_power: Sun, solar_water_heating: Sunrise, fibre_internet: Wifi, prepaid_electricity: Zap, sewer_connection: Toilet,
  fitted_kitchen: ChefHat, built_in_wardrobes: Shirt, en_suite: Bath, dsq: House, study_room: BookOpen, walk_in_closet: Shirt, balcony: DoorOpen, fireplace: Flame, air_conditioning: Fan, laundry_room: WashingMachine, pantry: Boxes, wooden_floors: Layers,
  garden: Flower2, swimming_pool: Waves, terrace: Sun, bbq_area: Flame, children_play_area: Trees,
  parking: CircleParking, visitor_parking: Car, lift: ArrowUpDown, tarmac_road: Route, wheelchair_accessible: Accessibility, pet_friendly: PawPrint,
  gym: Dumbbell, clubhouse: Armchair, sauna_steam: Wind, sports_courts: Trophy,
  loading_bay: Container, three_phase_power: Zap, reception_area: Sofa, conference_room: Presentation, fire_safety: FireExtinguisher,
  road_frontage: Route, fenced: Fence, electricity_nearby: Plug, water_on_site: Droplets, serviced_plot: Building2, flat_terrain: Mountain, ready_for_development: Hammer,
};
const BY_GROUP: Record<string, LucideIcon> = { security: ShieldCheck, utilities: Zap, interior: Sofa, outdoor: Trees, building: Building2, lifestyle: Dumbbell, commercial: BriefcaseBusiness, land: Leaf };

/** A colour for each group, in light and dark, shared by the listing page and the create form. */
export const GROUP_TONE: Record<string, string> = {
  security: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
  utilities: "bg-amber-500/12 text-amber-600 dark:text-amber-400",
  interior: "bg-violet-500/12 text-violet-600 dark:text-violet-400",
  outdoor: "bg-green-500/12 text-green-600 dark:text-green-400",
  building: "bg-sky-500/12 text-sky-600 dark:text-sky-400",
  lifestyle: "bg-rose-500/12 text-rose-600 dark:text-rose-400",
  commercial: "bg-indigo-500/12 text-indigo-600 dark:text-indigo-400",
  land: "bg-lime-500/12 text-lime-700 dark:text-lime-400",
  other: "bg-blue-500/12 text-blue-600 dark:text-blue-400",
};

export function FeatureIcon({ k, group = "other", className = "size-4" }: { k?: string; group?: string; className?: string }) {
  const Icon = (k && BY_KEY[k]) || BY_GROUP[group] || ShieldCheck;
  return <Icon className={className} aria-hidden />;
}

export const NEARBY_ICON: Record<string, { icon: LucideIcon; tone: string }> = {
  school: { icon: GraduationCap, tone: GROUP_TONE["building"]! },
  hospital: { icon: Stethoscope, tone: GROUP_TONE["lifestyle"]! },
  shopping: { icon: ShoppingBag, tone: GROUP_TONE["utilities"]! },
  transport: { icon: Bus, tone: GROUP_TONE["security"]! },
  food: { icon: Utensils, tone: GROUP_TONE["interior"]! },
  worship: { icon: Church, tone: GROUP_TONE["commercial"]! },
  recreation: { icon: Trees, tone: GROUP_TONE["outdoor"]! },
  other: { icon: Landmark, tone: GROUP_TONE["other"]! },
};
