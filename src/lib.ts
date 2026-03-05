import {
  type Choice,
  type SelectOptions,
  type SelectStickyStatusState,
  select,
} from "./components/select/component";
import {
  type InputOptions,
  type InputResult,
  type InputStickyStatusState,
  input,
} from "./components/input/component";
import { type InputCommand } from "./components/input/helpers";
import {
  printError,
  printStatus,
  printToolCall,
} from "./components/display/component";
import {
  type AsyncTaskEntry,
  type AsyncTask,
  Spinner,
  type SpinnerOptions,
  withSpinner,
  type WithSpinnerOptions,
} from "./components/spinner/component";
import {
  createStickyStatusBar,
  type StickyStatusBar,
  type StickyStatusBarOptions,
} from "./components/sticky-status-bar/component";
import { HistoryManager } from "./utils/history";

export {
  select,
  input,
  Spinner,
  withSpinner,
  HistoryManager,
  printStatus,
  printToolCall,
  printError,
  createStickyStatusBar,
};
export type {
  AsyncTask,
  AsyncTaskEntry,
  InputCommand,
  InputStickyStatusState,
  InputOptions,
  InputResult,
  SpinnerOptions,
  Choice,
  SelectOptions,
  SelectStickyStatusState,
  StickyStatusBar,
  StickyStatusBarOptions,
  WithSpinnerOptions,
};
