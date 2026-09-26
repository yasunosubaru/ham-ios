import {readFileSync} from 'fs';
import {join} from 'path';
import {AppRegistry} from 'react-native';

describe('app entry registrations', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('registers only the production Ham component', () => {
    const registerComponent = jest.spyOn(AppRegistry, 'registerComponent');
    require('../index.js');

    const registered = registerComponent.mock.calls.map(call => call[0]);
    expect(registered).toEqual(['Ham']);
    expect(registerComponent).toHaveBeenCalledWith('Ham', expect.any(Function));
  });

  it('keeps debug-only registrations in a separate entry point', () => {
    const productionSource = readFileSync(
      join(__dirname, '../index.js'),
      'utf8',
    );
    const debugSource = readFileSync(
      join(__dirname, '../index.debug.js'),
      'utf8',
    );

    expect(productionSource).not.toContain('RNFetchCourseViewE2E');
    expect(debugSource).toContain('RNFetchCourseViewE2E');
    expect(debugSource).toContain('registerCallableModule');
  });

  it('does not install the education callable bridge at startup', () => {
    const entrySource = readFileSync(join(__dirname, '../index.js'), 'utf8');

    expect(entrySource).not.toContain('registerCallableModule');
  });

  it('does not install the e2e fetch fixture at startup', () => {
    const pristine = global.fetch;
    require('../index.js');
    expect(global.fetch).toBe(pristine);
    expect(
      (global.fetch as {__e2eScenario?: string}).__e2eScenario,
    ).toBeUndefined();
  });
});
