
import * as TE from 'fp-ts/TaskEither'
import * as E from 'fp-ts/Either'

import { pipe } from 'fp-ts/lib/function';
import {formatValidationErrors} from 'io-ts-reporters'
import {Value} from '../../../../../../../../src/language/core/v1/semantics/contract/common/value'
import * as path from 'path'
import { MarloweJSONCodec, minify } from '../../../../../../../../src/common/json';
import {  getFileContents } from '../../../../../../../../src/common/file';
import { fileURLToPath } from 'url';


const getfilename = () => fileURLToPath(import.meta.url);
export const currentDirectoryPath  = () => path.dirname(getfilename());

describe('value', () => {

  it.each(['value'])
    ('(%p) can be decoded/encoded and is isomorphic', async (filename) => {                           
    
    await pipe( TE.Do 
              , TE.bind('uncoded', () =>  getFileContents(path.join(currentDirectoryPath(), `/jsons/${filename}.json`)))
              , TE.bind('decoded', ({uncoded}) => TE.of(MarloweJSONCodec.decode(uncoded)))
              , TE.bindW('typed', ({decoded}) => 
                      TE.fromEither(pipe( Value.decode(decoded)
                                        , E.mapLeft(formatValidationErrors))))
              , TE.bindW('encoded', ({typed}) => TE.of(MarloweJSONCodec.encode(typed)))
              , TE.match(
                    (e) => { console.dir(e, { depth: null }); expect(e).not.toBeDefined()},
                    ({encoded,uncoded}) => {expect(minify(encoded)).toEqual(minify(uncoded))})) ()
                              
  })

})


