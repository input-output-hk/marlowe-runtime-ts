import * as t from "io-ts/lib/index.js";
import { Metadata, MetadataGuard } from "@marlowe.io/runtime-core";
import { BigIntOrNumberGuard } from "@marlowe.io/adapter/bigint";
import { TemplateParam, TemplateType, templateParamsCodec, templateParamsObjectGuard } from "./template-param.js";

/**
 * This class represents an error while decoding the Metadata according to a {@link MarloweTemplate}.
 * @category Template
 */
export class DecodingTemplateError extends Error {
  constructor(
    public template: MarloweTemplate<any>,
    /**
     * @see {@link https://github.com/gcanti/io-ts/blob/master/index.md#error-reporters | io-ts errors }
     */
    public error: t.Errors
  ) {
    super("Error while decoding a template");
    this.name = "DecodingTemplateError";
  }
}

/**
 * This class holds information on the parameters required to create a Marlowe contract and
 * a way to serialize them {@link MarloweTemplate.toMetadata | to} and {@link MarloweTemplate.fromMetadata | from}  {@link @marlowe.io/runtime-core!index.Metadata}.
 * The order of the parameters is important as they drive the serialization.
 *
 * The Metadata encoding is as following:
 * A top level entry with key `9041` and value with an object with two fields:
 * - `v` a numeric version of the Template encoding (current version is 1)
 * - `params` an array of the encoded parameters with the same order as the Template parameters.
 * @see {@link TemplateParam} to see how each parameter is encoded.
 * @typeParam ObjectParams - The inferred type of the `options.params` as an object.
 * @experimental
 * @category Template
 */
export class MarloweTemplate<ObjectParams extends object> {
  private templateCodec: t.Type<ObjectParams, Metadata, unknown>;
  name: string;
  description?: string;
  /**
   * Manual constructor for the MarloweTemplate class, you should use {@link mkMarloweTemplate} instead.
   * @typeParam ObjectParams - The inferred type of the `options.params` as an object.
   * @param options - The {@link MkTemplateOptions | options} to create a new MarloweTemplate.
   */
  constructor(options: MkTemplateOptions<readonly TemplateParam<any>[]>) {
    const templateParams = options.params;
    this.name = options.name;
    this.description = options.description;

    const paramListCodec = templateParamsCodec(templateParams);
    const paramObjectCodec = templateParamsObjectGuard(templateParams);

    this.templateCodec = MetadataGuard.pipe(
      new t.Type<ObjectParams, Metadata, Metadata>(
        options.name,
        paramObjectCodec.is,
        (val, ctx) => {
          const metadatum = val[9041] ?? (val["9041"] as unknown);
          if (typeof metadatum === "undefined") {
            return t.failure(val, ctx, "Missing metadata entry 9041");
          }
          if (typeof metadatum !== "object") {
            return t.failure(val, ctx, "Metadata entry 9041 is not an object");
          }
          if (metadatum === null) {
            return t.failure(val, ctx, "Metadata entry 9041 is null");
          }

          if ("v" in metadatum === false) {
            return t.failure(val, ctx, "Metadata entry 9041 doesn't have a version field");
          }
          if ("params" in metadatum === false) {
            return t.failure(val, ctx, "Metadata entry 9041 doesn't have a params field");
          }

          const version = metadatum["v" as any];

          if (!BigIntOrNumberGuard.is(version) || BigIntOrNumberGuard.encode(version) !== 1n) {
            return t.failure(val, ctx, "Metadata entry 9041 has an invalid version");
          }

          const paramList = paramListCodec.decode(metadatum["params" as any]);
          if (paramList._tag === "Left") {
            return t.failure(paramList.left[0].value, paramList.left[0].context, "Invalid params");
          }
          const result = {} as any;
          templateParams.forEach((param, ix) => {
            result[param.name] = paramList.right[ix];
          });
          return t.success(result as ObjectParams);
        },
        (values) => {
          // FIXME: Try to type
          let valuesAsList: any[] = [];

          templateParams.forEach((param, ix) => {
            const value = (values as any)[param.name];
            if (typeof value === "undefined") {
              throw new Error(`The value for ${param.name} is missing`);
            }
            valuesAsList.push(value);
          });
          return {
            "9041": {
              v: 1,
              params: paramListCodec.encode(valuesAsList),
            },
          };
        }
      )
    );
  }

  /**
   * Type guard for the ObjectParams type.
   * @param value - an unknown value to check if it is a valid ObjectParams.
   * @returns true if the value is a valid ObjectParams, false otherwise.
   */
  is(value: unknown): value is ObjectParams {
    return this.templateCodec.is(value);
  }
  /**
   * Decodes a Metadata into an ObjectParams.
   * @param value - a Metadata to decode.
   * @returns the decoded ObjectParams.
   * @throws {@link DecodingTemplateError} - if the value is not a valid Metadata.
   */
  fromMetadata(value: Metadata): ObjectParams {
    const decoded = this.templateCodec.decode(value);
    if (decoded._tag === "Right") {
      return decoded.right;
    } else {
      throw new DecodingTemplateError(this, decoded.left);
    }
  }
  /**
   * Encodes the given value into a Metadata object.
   *
   * @param value The value to be encoded.
   * @returns The encoded Metadata object.
   */
  toMetadata(value: ObjectParams) {
    return this.templateCodec.encode(value);
  }
}

/**
 * This type function helps expanding the calculation of a type. It is used
 * in {@link mkMarloweTemplate} to show the results of {@link TemplateType}. When it is not used,
 * the types are hard to read.
 * @internal
 * @category Type functions
 */
export type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;

/**
 * @category Template
 */
export type TemplateParametersOf<T> = T extends MarloweTemplate<infer U> ? U : never;

/**
 * Options to create a new {@link MarloweTemplate}.
 * @typeParam ListParams - An ordered list of the different parameters that conform the marlowe template.
 * @category Template
 */
export interface MkTemplateOptions<ListParams extends readonly TemplateParam<any>[]> {
  /**
   * The name of the template.
   */
  name: string;
  /**
   * An optional description of the template.
   */
  description?: string;
  /**
   * The different parameters that conform the template.
   */
  params: ListParams;
}

/**
 * Creates a new {@link MarloweTemplate} with the given options.
 * This function helps with the inference of the un-ordered ObjectParams record from the ordered ListParams.
 *
 * ObjectParams are useful when coding, to provide name to the parameter without caring about the order,
 * and ListParams are useful to specify how the template parameters should be encoded/decoded in a space performant way.
 * @experimental
 * @typeParam ListParams - An ordered list of the different parameters that conform the template.
 * @category Template
 */
export function mkMarloweTemplate<ListParams extends readonly TemplateParam<any>[]>(
  options: MkTemplateOptions<ListParams>
): MarloweTemplate<Expand<TemplateType<ListParams>>> {
  return new MarloweTemplate(options);
}
