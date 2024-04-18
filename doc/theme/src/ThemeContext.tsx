import { DefaultTheme, DefaultThemeRenderContext, JSX, Options, PageEvent, Reflection } from "typedoc";
import * as templates from "./templates";

function bind<F, L extends any[], R>(fn: (f: F, ...a: L) => R, first: F) {
  return (...r: L) => fn(first, ...r);
}

export class ThemeContext extends DefaultThemeRenderContext {
  constructor(theme: DefaultTheme, page: PageEvent<Reflection>, options: Options) {
    super(theme, page, options);
    this.init();
  }
  init() {
    for (const [key, tpl] of Object.entries(templates)) {
      this[key as keyof ThemeContext] = bind(tpl as any, this) as any;
    }
  }
}
