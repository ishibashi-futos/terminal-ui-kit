import {
  type Choice,
  type SelectOptions,
  select,
} from "./components/select/component";
import {
  type InputOptions,
  type InputResult,
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
};
export type {
  AsyncTask,
  AsyncTaskEntry,
  InputCommand,
  InputOptions,
  InputResult,
  SpinnerOptions,
  Choice,
  SelectOptions,
  WithSpinnerOptions,
};
