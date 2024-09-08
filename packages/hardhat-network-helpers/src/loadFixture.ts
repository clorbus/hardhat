import type { SnapshotRestorer } from "./helpers/takeSnapshot";

import {
  FixtureAnonymousFunctionError,
  FixtureSnapshotError,
  InvalidSnapshotError,
} from "./errors";

type Fixture<T> = (...args: any[]) => Promise<T>;

interface Snapshot<T> {
  restorer: SnapshotRestorer;
  fixture: Fixture<T>;
  args: any[];
  data: T;
}

let snapshots: Array<Snapshot<any>> = [];

/**
 * Useful in tests for setting up the desired state of the network.
 *
 * Executes the given function and takes a snapshot of the blockchain. Upon
 * subsequent calls to `loadFixture` with the same function and arguments,
 * rather than executing the function again, the blockchain will be restored to that
 * snapshot.
 *
 * _Warning_: don't use `loadFixture` with an anonymous function, otherwise the
 * function will be executed each time instead of using snapshots:
 *
 * - Correct usage: `loadFixture(deployTokens)` or `loadFixture(deployTokens, [arg1, arg2])`
 * - Incorrect usage: `loadFixture(async () => { ... })`
 */
export async function loadFixture<T>(
  fixture: Fixture<T>,
  args: any[] = []
): Promise<T> {
  if (fixture.name === "") {
    throw new FixtureAnonymousFunctionError();
  }

  const cacheKey = JSON.stringify([fixture.name, args]);
  const snapshot = snapshots.find(
    (s) => JSON.stringify([s.fixture.name, s.args]) === cacheKey
  );

  const { takeSnapshot } = await import("./helpers/takeSnapshot");

  if (snapshot !== undefined) {
    try {
      await snapshot.restorer.restore();
      snapshots = snapshots.filter(
        (s) =>
          Number(s.restorer.snapshotId) <= Number(snapshot.restorer.snapshotId)
      );
    } catch (e) {
      if (e instanceof InvalidSnapshotError) {
        throw new FixtureSnapshotError(e);
      }

      throw e;
    }

    return snapshot.data;
  } else {
    const data = args.length > 0 ? await fixture(...args) : await fixture();
    const restorer = await takeSnapshot();

    snapshots.push({
      restorer,
      fixture,
      args,
      data,
    });

    return data;
  }
}

/**
 * Clears every existing snapshot.
 */
export async function clearSnapshots() {
  snapshots = [];
}
