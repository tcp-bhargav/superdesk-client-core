// extract-text-webpack-plugin messes up the import order
// when importing from SCSS files, but it works when importing from js
// if you need some styles to go at the top/bottom, import it here

import 'app.scss'; // styles

import 'jquery-jcrop/css/jquery.Jcrop.css';
import 'jquery-ui/themes/smoothness/jquery-ui.css';
import 'owl.carousel/dist/assets/owl.carousel.min.css';
import 'superdesk-ui-framework/dist/superdesk-ui.bundle.css';

import 'vendor';
import 'core';
import 'templates-cache.generated'; // generated by grunt 'ngtemplates' task
import 'apps';
import 'external-apps';
import {appConfig, getUserInterfaceLanguage, debugInfo} from 'appConfig';
import {IConfigurableUiComponents, IConfigurableAlgorithms} from 'superdesk-api';
import {CC} from 'core/ui/configurable-ui-components';
import {IExtensionLoader, registerExtensions} from 'core/register-extensions';
import {setupTansa} from 'apps/tansa';
import {i18n} from 'core/utils';
import {configurableAlgorithms} from 'core/ui/configurable-algorithms';
import {merge} from 'lodash';
import {registerAuthoringReactWidgets} from 'apps/authoring-react/manage-widget-registration';
import {registerEditor3AsCustomField} from 'apps/authoring-react/manage-editor3-inside-authoring-react';

let body = angular.element('body');

function loadConfigs() {
    return fetch(appConfig.server.url + '/client_config', {
        method: 'GET',
        mode: 'cors',
    })
        .then((res) => res.ok ? res.json() : Promise.reject())
        .then((json) => {
            merge(appConfig, json.config);
        });
}

export function loadTranslations() {
    const language = getUserInterfaceLanguage();

    return (() => {
        if (language === 'en') {
            return Promise.resolve({'': {'language': 'en', 'plural-forms': 'nplurals=2; plural=(n != 1);'}});
        } else {
            const filename = `/languages/${language}.json?nocache=${Date.now()}`;

            return fetch(filename)
                .then((response) => response.json())
                .then((translations) => {
                    if (
                        translations[''] == null
                        || translations['']['language'] == null
                        || translations['']['plural-forms'] == null
                    ) {
                        throw new Error(`Language metadata not found in "${filename}"`);
                    }

                    return translations;
                });
        }
    })().then((translations) => {
        const langOverride = appConfig.langOverride ?? {};
        const pluralForms = translations['']['plural-forms'];

        if (langOverride[language] != null) {
            Object.assign(translations, langOverride[language]);
        }

        i18n.setMessages(
            'messages',
            language,
            translations,
            pluralForms,
        );

        i18n.setLocale(language);

        return {
            translations,
            language,
        };
    });
}

let started = false;

function isDateFormatValid() {
    const {dateformat} = appConfig.view;

    if (
        dateformat.includes('YYYY') !== true
        || dateformat.includes('MM') !== true
        || dateformat.includes('DD') !== true
    ) {
        return false;
    }

    const separators = dateformat
        .replace('YYYY', '')
        .replace('MM', '')
        .replace('DD', '');

    if (separators.length !== 2 || separators[0] !== separators[1]) {
        return false;
    }

    return true;
}

export function startApp(
    extensions: Array<IExtensionLoader>,
    customUiComponents: IConfigurableUiComponents,
    customAlgorithms: IConfigurableAlgorithms = {},
) {
    if (started === true) {
        return;
    }

    started = true;

    for (const key in customUiComponents) {
        if (customUiComponents.hasOwnProperty(key)) {
            CC[key] = customUiComponents[key];
        }
    }

    for (const key in customAlgorithms) {
        if (customAlgorithms.hasOwnProperty(key)) {
            configurableAlgorithms[key] = customAlgorithms[key];
        }
    }

    // update config via config.js
    if (window.superdeskConfig) {
        angular.merge(appConfig, window.superdeskConfig);
    }

    // non-mock app configuration must live here to allow tests to override
    // since tests do not import this file.
    angular.module('superdesk.config').constant('config', appConfig);

    // added to be able to register activities which didn't work using superdesk reference injected in `core.run`.
    var _superdesk;
    var _workspaceMenu;

    angular.module('superdesk.register_extensions', [])
        .config(['superdeskProvider', 'workspaceMenuProvider', (superdesk, workspaceMenu) => {
            _superdesk = superdesk;
            _workspaceMenu = workspaceMenu;
        }])
        .run([
            'modal',
            'privileges',
            'lock',
            'session',
            'authoringWorkspace',
            'config',
            'metadata',
            'preferencesService',
            (
                modal,
                privileges,
                lock,
                session,
                authoringWorkspace,
                config,
                metadata,
                preferencesService,
            ) => {
                registerExtensions(
                    extensions,
                    _superdesk,
                    modal,
                    privileges,
                    lock,
                    session,
                    authoringWorkspace,
                    config,
                    metadata,
                    _workspaceMenu,
                    preferencesService,
                ).then(() => {
                    registerAuthoringReactWidgets();
                    registerEditor3AsCustomField();
                });
            },
        ]);

    loadConfigs()
        .then(
            () => loadTranslations().then(() => {
                debugInfo.translationsLoaded = true;
            }),
        )
        .then(() => {
            if (isDateFormatValid() !== true) {
                document.write('Invalid date format specified in config.view.dateFormat');
                return;
            }
            /**
             * @ngdoc module
             * @name superdesk-client
             * @packageName superdesk-client
             * @description The root superdesk module.
             */
            angular.bootstrap(body, [
                'superdesk.config',
                'superdesk.core',
                'superdesk.apps',
                'superdesk.register_extensions',
            ].concat(appConfig.apps || []), {strictDi: true});

            window['superdeskIsReady'] = true;

            if (appConfig.features.useTansaProofing) {
                setupTansa();
            }
        });
}

// the application should be started by importing and calling `startApp` from a customer repository
// this is a fallback for e2e tests.
setTimeout(() => {
    if (started !== true) {
        startApp([], {});
    }
}, 500);
