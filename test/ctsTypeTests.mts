import type * as cts from '../src/index.ts'
import type * as esm from '../src/index.mts'

// ensure that CJS and ESM export the same values
// (I don't think theres a way to check that they export the same types
// in one blanket statement)
null as any as typeof cts satisfies typeof esm
