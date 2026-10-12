/**
 * @/design-system
 *
 * Tokens, fonts and shared UI primitives.
 *
 * Rules for this package:
 *  - no feature logic, no API calls, no router imports - a component here must be
 *    usable on any screen;
 *  - all values come from tokens.css, so a brand change is a token change;
 *  - anything used on exactly one screen belongs in that feature folder instead.
 *
 * Import the stylesheets once, in the app shell:
 *   import '@/design-system/styles/foundation.css';
 */

export { Button, type ButtonProps, type ButtonSize, type ButtonVariant } from './components/Button';
export {
  AssistantBadge,
  AssistantChoices,
  AssistantDock,
  AssistantQuickAction,
  AssistantSay,
  type AssistantAttachment,
  type AssistantDockProps,
  type AssistantTurn,
} from './components/AssistantDock';
export {
  Stepper,
  ViewSwitcher,
  type StepperProps,
  type ViewSwitcherOption,
  type ViewSwitcherProps,
} from './components/ActionControls';
export {
  DrawerBody, DrawerCard, DrawerFooter, DrawerHeader, DrawerWide, type DrawerCardProps,
} from './components/Drawer';
export { Footer, type FooterLink, type FooterProps } from './components/Footer';
export { Header, type HeaderProps } from './components/Header';
export { InfoRibbon, type InfoRibbonProps } from './components/InfoRibbon';
export { Input, type InputProps } from './components/Input';
export { Textarea, type TextareaProps } from './components/Textarea';
export { RangeIntervalSlider, RangeSlider, type RangeIntervalSliderProps, type RangeSliderProps } from './components/RangeSlider';
export {
  ChipToggleGroup,
  FilterChip as SelectionFilterChip,
  RadioCardGroup,
  TransportModePicker,
  type ChipToggleGroupProps,
  type ChipToggleOption,
  type FilterChipProps as SelectionFilterChipProps,
  type RadioCardGroupProps,
  type SelectionOption,
  type TransportModeOption,
  type TransportModePickerProps,
} from './components/SelectionControls';
export { NewsCard, type NewsCardProps } from './components/NewsCard';
export { SectionHeading, type SectionHeadingProps } from './components/SectionHeading';
export { Provenance, type ProvenanceOverride, type ProvenanceProps } from './components/Provenance';
export { Select, type SelectOption, type SelectProps } from './components/Select';
export { StatCounter, type StatCounterProps } from './components/StatCounter';
export { Tabs, type TabItem, type TabsProps } from './components/Tabs';
/* shadcn primitives are imported from @/design-system/primitives/<name>, the
   path components.json aliases as "ui". They are deliberately not re-exported
   here: components/Input is a different component that already owns the name. */
export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel, DropdownMenuGroup, DropdownMenuCheckboxItem, DropdownMenuRadioGroup, DropdownMenuRadioItem } from './primitives/dropdown-menu';
export {
  DataTable,
  Pagination,
  type TableColumn,
  type TableSelection,
} from './components/DataTable';
export {
  AmountCell,
  CountedTabs,
  ListingSegments,
  ListingToolbar,
  FilterDrawer,
  FilterSection,
  FilterChip,
  RouteCargoCell,
  RouteCell,
  StackedCell,
  StatusPill,
  ValidityMeter,
} from './components/DataView';
export { ListingHero, type ListingHeroProps, type PipelineSegment } from './components/ListingHero';
export {
  DataGrid,
  type DataGridFilter,
  type DataGridFilterOption,
  type DataGridFilterValues,
  type DataGridLabels,
  type DataGridProps,
  type DataGridTab,
} from './components/DataGrid';
export { HeroBand, HeroChip, type HeroBandProps, type HeroRoute } from './components/HeroBand';
export { RouteBreadcrumb, type RouteBreadcrumbProps, type RouteBreadcrumbStep } from './components/RouteBreadcrumb';
export { ModeCards, type ModeCardOption, type ModeCardsProps } from './components/ModeCards';
export { RadioCards, type RadioCardOption, type RadioCardsProps } from './components/RadioCards';
export { ChipToggles, FilterPills, type ChipToggleOption as ChipTogglesOption, type ChipTogglesProps, type FilterPillOption, type FilterPillsProps } from './components/ChipToggles';
export { ModeLadder, type ModeLadderItem, type ModeLadderProps } from './components/ModeLadder';
export { RingGauge, type RingGaugeFact, type RingGaugeProps } from './components/RingGauge';
export { SparklineTrend, type SparklineTrendProps } from './components/SparklineTrend';
export { ChargeBreakdown, type ChargeBreakdownProps, type ChargeGroup, type ChargeTone } from './components/ChargeBreakdown';
export { IncotermStrip, type HandoverStage, type IncotermStripProps } from './components/IncotermStrip';
export { DateDisplay, dateParts, type DateDisplayProps, type DateDisplayVariant, type DateParts, type DatePartsOptions } from './components/DateDisplay';
export { DateField, type DateFieldProps } from './components/DateField';
export { DatePicker, type DatePickerLegend, type DatePickerProps, type DateShortcut } from './components/DatePicker';
export { DayPicker, type DayPickerProps, type WeekdayOption } from './components/DayPicker';
export { SchedulePicker, type SchedulePickerProps } from './components/SchedulePicker';
export { ContainerUtilisation, type ContainerUtilisationProps, type UtilisationMeasure } from './components/ContainerUtilisation';
export { FreeTimeMeter, type FreeTimeDay, type FreeTimeFact, type FreeTimeMeterProps, type FreeTimeState } from './components/FreeTimeMeter';
export { LegBreakdown, type LegBreakdownProps, type LegTone, type TransitLeg } from './components/LegBreakdown';
export { RouteProgress, type RouteProgressProps } from './components/RouteProgress';
export { StatTile, type SparkBar, type StatTileProps, type StatTone } from './components/StatTile';
export { LoadingThread, type LoadingThreadProps } from './components/LoadingThread';
export { RouteLoader, type RouteLoaderProps, type RouteLoaderStep } from './components/RouteLoader';
export { Spinner, type SpinnerProps, type SpinnerSize, type SpinnerVariant } from './components/Spinner';
export { ColdStart, type ColdStartItem, type ColdStartProps, type ColdStartVariant } from './components/ColdStart';
export { SkeletonRows, type SkeletonRowsProps } from './components/SkeletonRows';
export { ContainerFill, type ContainerFillProps } from './components/ContainerFill';
export { InlineTextWait, type InlineTextWaitProps } from './components/InlineTextWait';
export { RefreshOverlay, type RefreshOverlayProps } from './components/RefreshOverlay';
export { PartyCard, type PartyCardProps } from './components/PartyCard';
export { SelectedStrip, type SelectedItem, type SelectedStripProps } from './components/SelectedStrip';
export { Autocomplete, type AutocompleteOption, type AutocompleteProps } from './components/Autocomplete';
export { CardRail, type CardRailProps } from './components/CardRail';
export {
  BarLineChart,
  ChartLegend,
  ColumnBars,
  DonutChart,
  MeterCell,
  MiniLine,
  RangeBars,
  SplitBar,
  TrendLine,
  type BarLineChartProps,
  type BarLineSeries,
  type ChartLegendItem,
  type DonutSlice,
  type RangeRow,
  type SplitPart,
} from './components/Charts';
export {
  Co2Calculator,
  type Co2CalculatorLabels,
  type Co2CalculatorProps,
  type Co2Fact,
  type Co2Mode,
  type Co2ModeResult,
  type Co2Place,
  type Co2Preset,
} from './components/Co2Calculator';
export { ContainerSelector, type ContainerSelectorProps } from './components/ContainerSelector';
export { Code, type CodeProps } from './components/Code';
export {
  ConfirmationDialog,
  type ConfirmationDialogProps,
} from './components/ConfirmationDialog';
export { ComboInput, type ComboInputProps } from './components/ComboInput';
export {
  ComponentDirectory,
  type ComponentDirectoryItem,
  type ComponentDirectoryLabels,
  type ComponentDirectoryProps,
} from './components/ComponentDirectory';
export { DateValue, formatDate, formatTime, type DateValueProps } from './components/DateValue';
export {
  LogisticsIcon,
  LOGISTICS_ICONS,
  LOGISTICS_ICON_NAMES,
  type LogisticsIconName,
  type LogisticsIconProps,
  type LogisticsIconSize,
  UiGlyph,
  type UiGlyphName,
  type UiGlyphProps,
} from './icons';
export {
  Badge,
  Checkbox,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  StatePanel,
  Switch,
  Tab,
  TabGroup,
  TabList,
  TabPanel,
  Tooltip,
} from './components/Controls';
