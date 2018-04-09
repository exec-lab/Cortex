'use strict';

import _ from 'lodash';

import AnalyzerRunController from './analyzer.run.controller';
import runAnalyzerModalTpl from './analyzer.run.modal.html';

export default class AnalyzerService {
  constructor($log, $q, $http, $uibModal) {
    'ngInject';

    this.$log = $log;
    this.$q = $q;
    this.$http = $http;
    this.$uibModal = $uibModal;

    this.analyzerDefinitions = null;
    this.analyzers = null;
    this.dataTypes = {};
  }

  getTypes() {
    return this.dataTypes;
  }

  definitions(force) {
    let defered = this.$q.defer();

    if (force || this.analyzerDefinitions === null) {
      this.$http.get('./api/analyzerdefinition').then(
        response => {
          this.analyzerDefinitions = _.keyBy(response.data, 'id');

          defered.resolve(this.analyzerDefinitions);
        },
        response => {
          defered.reject(response);
        }
      );
    } else {
      defered.resolve(this.analyzerDefinitions);
    }

    return defered.promise;
  }

  scan() {
    let defer = this.$q.defer();

    this.$http
      .post('./api/analyzerdefinition/scan', {})
      .then(response => defer.resolve(response.data))
      .catch(err => defer.reject(err));

    return defer.promise;
  }

  list() {
    let defered = this.$q.defer();

    this.$http.get('./api/analyzer', { params: { range: 'all' } }).then(
      response => {
        this.analyzers = response.data;
        this.dataTypes = _.sortBy(
          _.uniq(_.flatten(_.map(response.data, 'dataTypeList')))
        );

        defered.resolve(response.data);
      },
      response => {
        defered.reject(response);
      }
    );

    return defered.promise;
  }

  configurations() {
    let defer = this.$q.defer();
    this.$http
      .get('./api/analyzerconfig')
      .then(response => defer.resolve(response.data), err => defer.reject(err));

    return defer.promise;
  }

  getBaseConfig(baseConfig) {
    let defer = this.$q.defer();

    if (baseConfig) {
      this.getConfiguration(baseConfig).then(
        cfg => defer.resolve(cfg),
        () => defer.resolve({})
      );
    } else {
      defer.resolve({});
    }

    return defer.promise;
  }

  getConfiguration(name) {
    let defer = this.$q.defer();

    this.$http
      .get(`./api/analyzerconfig/${name}`)
      .then(response => defer.resolve(response.data), err => defer.reject(err));

    return defer.promise;
  }

  saveConfiguration(name, values) {
    let defer = this.$q.defer();

    this.$http
      .patch(`./api/analyzerconfig/${name}`, values)
      .then(response => defer.resolve(response.data), err => defer.reject(err));

    return defer.promise;
  }

  openRunModal(analyzers, observable) {
    let modalInstance = this.$uibModal.open({
      animation: true,
      templateUrl: runAnalyzerModalTpl,
      controller: AnalyzerRunController,
      controllerAs: '$modal',
      size: 'lg',
      resolve: {
        observable: () => angular.copy(observable),
        analyzers: () => angular.copy(analyzers)
      }
    });

    return modalInstance.result.then(result =>
      this.$q.all(
        result.analyzerIds.map(analyzerId =>
          this.run(analyzerId, result.observable)
        )
      )
    );
  }

  run(id, artifact) {
    let postData;

    if (artifact.dataType === 'file') {
      postData = {
        attachment: artifact.attachment,
        dataType: artifact.dataType,
        tlp: artifact.tlp
      };

      return this.$http({
        method: 'POST',
        url: './api/analyzer/' + id + '/run',
        headers: {
          'Content-Type': undefined
        },
        transformRequest: data => {
          let formData = new FormData(),
            copy = angular.copy(data, {}),
            _json = {};

          angular.forEach(data, (value, key) => {
            if (
              Object.getPrototypeOf(value) instanceof Blob ||
              Object.getPrototypeOf(value) instanceof File
            ) {
              formData.append(key, value);
              delete copy[key];
            } else {
              _json[key] = value;
            }
          });

          formData.append('_json', angular.toJson(_json));

          return formData;
        },
        data: postData
      });
    } else {
      postData = {
        data: artifact.data,
        attributes: {
          dataType: artifact.dataType,
          tlp: artifact.tlp
        }
      };

      return this.$http.post('./api/analyzer/' + id + '/run', postData);
    }
  }
}
