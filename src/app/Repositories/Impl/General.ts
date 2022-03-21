/* eslint-disable max-classes-per-file */
import BaseElectronRepository from '@/app/Repositories/Impl/electron/Base';
import { GeneralRepository, PmRepository } from '@/app/Repositories/interfaces';

export class BaseGeneralRepository extends BaseElectronRepository implements GeneralRepository {
  openLink = (link: string) => {
    this.mainPreload.general.openLink(link);
  };
}

export class BasePmRepository extends BaseElectronRepository implements PmRepository {
  versions = () => this.mainPreload.pm.versions();
}
