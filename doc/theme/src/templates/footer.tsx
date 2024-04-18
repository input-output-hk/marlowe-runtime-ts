import { DefaultThemeRenderContext, JSX, PageEvent, Reflection } from "typedoc";

export const footer = (context: DefaultThemeRenderContext, props: PageEvent<Reflection>) => (
  <div class="tsd-generator">
    <div class="footer-links">
      <table>
        <tr>
          <th>Prototype Demos</th>
          <th>Tools</th>
          <th>Github Repositories</th>
          <th>Resources</th>
          <th>Legal</th>
        </tr>
        <tr>
          <td>
            <a href="https://payouts-preprod.prod.scdev.aws.iohkdev.io/">Payouts</a>
          </td>
          <td>
            <a href="https://play.marlowe.iohk.io/">Playground</a>
          </td>
          <td>
            <a href="https://github.com/input-output-hk/marlowe-ts-sdk">Marlowe ts-sdk</a>
          </td>
          <td>
            <a href="https://iohk.zendesk.com/hc/en-us/requests/new">IOG Tech Support</a>
          </td>
          <td>
            <a href="https://docs.google.com/document/d/13zJ5jdaKjXgAytvDn0kln8UFDhyFr3AS/view">Cookie Policy</a>
          </td>
        </tr>
        <tr>
          <td>
            <a href="https://token-plans-preprod.prod.scdev.aws.iohkdev.io/">Token Plan</a>
          </td>
          <td>
            <a href="https://preprod.runner.marlowe.iohk.io/">Preprod Runner</a>
          </td>
          <td>
            <a href="https://github.com/input-output-hk/marlowe-payouts">Payout Prototype</a>
          </td>
          <td>
            <a href="https://docs.marlowe.iohk.io/">Documentation</a>
          </td>
          <td>
            <a href="https://static.iohk.io/terms/iog-privacy-policy.pdf">Privacy Policy</a>
          </td>
        </tr>
        <tr>
          <td></td>
          <td>
            <a href="https://marlowescan.com/">Marlowe Scan</a>
          </td>
          <td>
            <a href="https://github.com/input-output-hk/marlowe-token-plans">Token Plan Prototype</a>
          </td>
          <td>
            <a href="https://marlowe.iohk.io/blog">Blog</a>
          </td>
          <td>
            <a href="https://plutus-static.s3.eu-central-1.amazonaws.com/IOHK+Website+Terms+%26+Conditions+(Final).pdf">
              Terms of Use
            </a>
          </td>
        </tr>
        <tr>
          <td></td>
          <td></td>
          <td></td>
          <td>
            <a href="https://marlowe.iohk.io/">Official Website</a>
          </td>
          <td></td>
        </tr>
      </table>
    </div>
    <div class="footer-copyright">© 2023 Input Output Global, Inc. All Rights Reserved.</div>
  </div>
);
