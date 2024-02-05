import fs from "node:fs/promises";
import { arrayOf, assert, lit, num, obj, objOf, str, unk } from "./typeguards";
import jsonBigInt from "json-bigint";
main()
  .then()
  .catch((err) => console.error("Exporter error", err));

type SymbolRewrite = {
  sym: unknown;
  newNodes: Set<string>;
};
function rewriteContractSymbol(sym: unknown): SymbolRewrite {
  if (lit("close")(sym)) {
    return { sym, newNodes: new Set() };
  }
  if (
    objOf({ from_account: unk, to: unk, token: unk, pay: unk, then: unk })(sym)
  ) {
    const cont = rewriteContractSymbol(sym.then);
    return {
      sym: {
        from_account: sym.from_account,
        to: sym.to,
        token: sym.token,
        pay: sym.pay,
        then: cont.sym,
      },
      newNodes: cont.newNodes,
    };
  }
  if (objOf({ if: unk, then: unk, else: unk })(sym)) {
    const contT = rewriteContractSymbol(sym.then);
    const contF = rewriteContractSymbol(sym.else);
    return {
      sym: { if: sym.if, then: contT.sym, else: contF.sym },
      newNodes: new Set([...contT.newNodes, ...contF.newNodes]),
    };
  }
  if (
    objOf({ when: arrayOf(unk), timeout: num, timeout_continuation: unk })(sym)
  ) {
    const whenSyms = sym.when.map(rewriteContractSymbol);
    const timeoutCont = rewriteContractSymbol(sym.timeout_continuation);
    let newNodes = new Set([...timeoutCont.newNodes]);
    whenSyms.forEach((c) => c.newNodes.forEach((s) => newNodes.add(s)));
    return {
      sym: {
        when: whenSyms.map((c) => c.sym),
        timeout: sym.timeout,
        timeout_continuation: timeoutCont.sym,
      },
      newNodes,
    };
  }
  if (objOf({ let: str, be: unk, then: unk })(sym)) {
    const cont = rewriteContractSymbol(sym.then);
    return {
      sym: { let: sym.let, be: sym.be, then: cont.sym },
      newNodes: cont.newNodes,
    };
  }
  if (objOf({ assert: unk, then: unk })(sym)) {
    const cont = rewriteContractSymbol(sym.then);
    return {
      sym: { assert: sym.assert, then: cont.sym },
      newNodes: cont.newNodes,
    };
  }
  if (objOf({ case: unk, then: unk })(sym)) {
    const cont = rewriteContractSymbol(sym.then);
    return {
      sym: { case: sym.case, then: cont.sym },
      newNodes: cont.newNodes,
    };
  }
  if (objOf({ case: unk, merkleized_then: str })(sym)) {
    return {
      sym: {
        case: sym.case,
        then: { import: `./${sym.merkleized_then}.json` },
      },
      newNodes: new Set([sym.merkleized_then]),
    };
  }
  throw new Error("Unrecognized symbol" + jsonBigInt.stringify(sym));
}

async function rewriteModuleFile(filepath: string, outputDir: string) {
  const modStr = await fs.readFile(filepath, { encoding: "utf8" });
  const mod = jsonBigInt.parse(modStr) as unknown;

  assert(objOf({ symbols: obj, main: str }), mod);
  let visited: Set<string> = new Set();
  let tovisit = new Set([mod.main]);

  for (let s of tovisit) {
    if (visited.has(s)) {
      continue;
    }
    console.log(`Rewriting ${s}`);
    visited.add(s);

    if (!(s in mod.symbols)) {
      throw new Error(`Symbol ${s} is not present in the symbol object`);
    }
    const newSym = rewriteContractSymbol((mod.symbols as any)[s]);
    await fs.writeFile(
      `${outputDir}/${s}.json`,
      jsonBigInt.stringify(newSym.sym)
    );
    newSym.newNodes.forEach((newCont) => tovisit.add(newCont));
  }
  console.log(
    `Finished rewriting, main entry is: ${outputDir}/${mod.main}.json`
  );
}
async function main() {
  const inputJson = process.argv[process.argv.length - 2];
  const outputDir = process.argv[process.argv.length - 1];
  console.log("Runtime exporter");
  console.log("  input JSON: ", inputJson);
  console.log("  output dir: ", outputDir);
  try {
    const inputJsonStat = await fs.stat(inputJson);
    if (!inputJsonStat.isFile()) {
      throw `"${inputJson}" is not a file`;
    }
    const outputDirStat = await fs.stat(outputDir);

    if (!outputDirStat.isDirectory()) {
      throw `"${outputDir}" is not a directory`;
    }
  } catch (err) {
    if (objOf({ toString: unk })(err)) {
      console.error((err as any).toString());
    } else {
      console.error(err);
    }
  }
  rewriteModuleFile(inputJson, outputDir);
}
