/* eslint-disable */
import * as Router from 'expo-router';

export * from 'expo-router';

declare module 'expo-router' {
  export namespace ExpoRouter {
    export interface __routes<T extends string | object = string> {
      hrefInputParams: { pathname: Router.RelativePathString, params?: Router.UnknownInputParams } | { pathname: Router.ExternalPathString, params?: Router.UnknownInputParams } | { pathname: `/_sitemap`; params?: Router.UnknownInputParams; } | { pathname: `/tabs/account`; params?: Router.UnknownInputParams; } | { pathname: `/tabs`; params?: Router.UnknownInputParams; } | { pathname: `/tabs/portfolios`; params?: Router.UnknownInputParams; } | { pathname: `/tabs/products`; params?: Router.UnknownInputParams; };
      hrefOutputParams: { pathname: Router.RelativePathString, params?: Router.UnknownOutputParams } | { pathname: Router.ExternalPathString, params?: Router.UnknownOutputParams } | { pathname: `/_sitemap`; params?: Router.UnknownOutputParams; } | { pathname: `/tabs/account`; params?: Router.UnknownOutputParams; } | { pathname: `/tabs`; params?: Router.UnknownOutputParams; } | { pathname: `/tabs/portfolios`; params?: Router.UnknownOutputParams; } | { pathname: `/tabs/products`; params?: Router.UnknownOutputParams; };
      href: Router.RelativePathString | Router.ExternalPathString | `/_sitemap${`?${string}` | `#${string}` | ''}` | `/tabs/account${`?${string}` | `#${string}` | ''}` | `/tabs${`?${string}` | `#${string}` | ''}` | `/tabs/portfolios${`?${string}` | `#${string}` | ''}` | `/tabs/products${`?${string}` | `#${string}` | ''}` | { pathname: Router.RelativePathString, params?: Router.UnknownInputParams } | { pathname: Router.ExternalPathString, params?: Router.UnknownInputParams } | { pathname: `/_sitemap`; params?: Router.UnknownInputParams; } | { pathname: `/tabs/account`; params?: Router.UnknownInputParams; } | { pathname: `/tabs`; params?: Router.UnknownInputParams; } | { pathname: `/tabs/portfolios`; params?: Router.UnknownInputParams; } | { pathname: `/tabs/products`; params?: Router.UnknownInputParams; };
    }
  }
}
