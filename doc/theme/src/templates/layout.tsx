import { ContainerReflection, DefaultThemeRenderContext, JSX, PageEvent, Reflection, RenderTemplate } from "typedoc";
import { classNames } from "./utils";

export const layout = (
  context: DefaultThemeRenderContext,
  template: RenderTemplate<PageEvent<Reflection>>,
  props: PageEvent<ContainerReflection>
) => {
  return (
    <html class="default" lang={context.options.getValue("htmlLang")}>
      <head>
        <meta charSet="utf-8" />
        {context.hook("head.begin")}
        <meta http-equiv="x-ua-compatible" content="IE=edge" />
        <meta name="description" content={"Documentation for " + props.project.name} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />

        <link rel="stylesheet" href={context.relativeURL("assets/style.css", true)} />
        <link rel="stylesheet" href={context.relativeURL("assets/highlight.css", true)} />
        <link rel="stylesheet" href={context.relativeURL("assets/marlowe/style.css")} />
        {context.options.getValue("customCss") && (
          <link rel="stylesheet" href={context.relativeURL("assets/custom.css", true)} />
        )}
        <script defer src={context.relativeURL("assets/main.js", true)}></script>
        <script async src={context.relativeURL("assets/search.js", true)} id="search-script"></script>
        <script async src={context.relativeURL("assets/navigation.js", true)} id="tsd-nav-script"></script>
        {context.hook("head.end")}
      </head>
      <body>
        {context.hook("body.begin")}
        {context.toolbar(props)}

        <div
          class={classNames({
            container: true,
            "container-main": true,
          })}
        >
          <div class="col-content">
            {context.hook("content.begin")}
            {context.header(props)}
            {template(props)}
            {context.hook("content.end")}
          </div>
          <div class="col-sidebar">
            <div class="page-menu">
              {context.hook("pageSidebar.begin")}
              {context.pageSidebar(props)}
              {context.hook("pageSidebar.end")}
            </div>
            <div class="site-menu">
              {context.hook("sidebar.begin")}
              {context.sidebar(props)}
              {context.hook("sidebar.end")}
            </div>
          </div>
        </div>

        {context.footer()}

        <div class="overlay"></div>

        {context.analytics()}
        {context.hook("body.end")}
      </body>
    </html>
  );
};
