## [0.5.3](https://github.com/bauer-group/CS-ScreenRecorder/compare/v0.5.2...v0.5.3) (2026-01-13)


### Bug Fixes

* clarify reason for replacement of Microsoft Entra ID patch ([0a2da52](https://github.com/bauer-group/CS-ScreenRecorder/commit/0a2da523ca537ececa6d0b84097cb1b1bde6e913))

## [0.5.2](https://github.com/bauer-group/CS-ScreenRecorder/compare/v0.5.1...v0.5.2) (2026-01-13)


### Bug Fixes

* disable cache for self-hosted runners in Docker build jobs ([d8060c7](https://github.com/bauer-group/CS-ScreenRecorder/commit/d8060c74cb4018343825051cda30b321ab862037))
* update documentation to indicate replacement by 006-microsoft-entra-id.ts ([7a43c4a](https://github.com/bauer-group/CS-ScreenRecorder/commit/7a43c4ae3dc0c6ea4ee45eef11a482d1a505ac6d))

## [0.5.1](https://github.com/bauer-group/CS-ScreenRecorder/compare/v0.5.0...v0.5.1) (2026-01-13)


### Bug Fixes

* implement helper function to skip irrelevant onboarding files for self-hosted deployments ([0276c47](https://github.com/bauer-group/CS-ScreenRecorder/commit/0276c47971b0ca1c097f17999666fec705b826b0))

# [0.5.0](https://github.com/bauer-group/CS-ScreenRecorder/compare/v0.4.7...v0.5.0) (2026-01-13)


### Bug Fixes

* add options for using pre-built branded image or official Cap image in Docker configurations ([a7685f9](https://github.com/bauer-group/CS-ScreenRecorder/commit/a7685f90e44eea627f0dd940cf60c558916d6492))
* specify 'runs-on' configuration for validation and release jobs to use self-hosted Linux environment ([55af57d](https://github.com/bauer-group/CS-ScreenRecorder/commit/55af57d586dac48df39d7010434dddac3ef47670))


### Features

* implement patch to skip onboarding steps for self-hosted deployments ([332482c](https://github.com/bauer-group/CS-ScreenRecorder/commit/332482c4700f02b7c65d4793107e2075cdc48129))

## [0.4.7](https://github.com/bauer-group/CS-ScreenRecorder/compare/v0.4.6...v0.4.7) (2026-01-12)


### Bug Fixes

* improve MinIO readiness check in Docker Compose files ([bb2e7d4](https://github.com/bauer-group/CS-ScreenRecorder/commit/bb2e7d4ac95fb2f5b7a041239d0713b231e3e9fa))
* remove default MINIO_REGION assignment in Docker Compose files for clarity ([222ea3b](https://github.com/bauer-group/CS-ScreenRecorder/commit/222ea3bc3746eaf8f806072820da7e62d8e48e75))
* rename MINIO_REGION to MINIO_SITE_REGION and add MINIO_SITE_NAME for clarity ([f119716](https://github.com/bauer-group/CS-ScreenRecorder/commit/f119716adbc642dd245c2f1161fc9d5bef239483))
* update S3 region configuration to use environment variable for flexibility ([5d58704](https://github.com/bauer-group/CS-ScreenRecorder/commit/5d5870420a3227ad0653cbf6c4e229c9d8f784ed))

## [0.4.6](https://github.com/bauer-group/CS-ScreenRecorder/compare/v0.4.5...v0.4.6) (2026-01-12)


### Bug Fixes

* **patches:** update comments in Stripe removal patch for clarity ([adcfbc9](https://github.com/bauer-group/CS-ScreenRecorder/commit/adcfbc904165af06ee104b6336bb082d31cf5a09))

## [0.4.5](https://github.com/bauer-group/CS-ScreenRecorder/compare/v0.4.4...v0.4.5) (2026-01-12)


### Bug Fixes

* **patches:** simulate unlimited Pro license for self-hosted deployments ([f5e0471](https://github.com/bauer-group/CS-ScreenRecorder/commit/f5e0471b094b833a9aaa4a4dcf9d8b1d6b156fca))

## [0.4.4](https://github.com/bauer-group/CS-ScreenRecorder/compare/v0.4.3...v0.4.4) (2026-01-12)


### Bug Fixes

* **patches:** update invite quota default to 10 million for self-hosted deployments ([ec15b36](https://github.com/bauer-group/CS-ScreenRecorder/commit/ec15b36f00a126d7eb634e65d300fcd38be75a0a))

## [0.4.3](https://github.com/bauer-group/CS-ScreenRecorder/compare/v0.4.2...v0.4.3) (2026-01-12)


### Bug Fixes

* **patches:** refine organization invite subscription check handling for self-hosted deployments ([7ad1a07](https://github.com/bauer-group/CS-ScreenRecorder/commit/7ad1a07166ecf4ced9cf370df2348fd47db7f22a))

## [0.4.2](https://github.com/bauer-group/CS-ScreenRecorder/compare/v0.4.1...v0.4.2) (2026-01-12)


### Bug Fixes

* **patches:** update invite quota handling to use function replacement for self-hosted deployments ([f8cc449](https://github.com/bauer-group/CS-ScreenRecorder/commit/f8cc44980e8ca3e4841754e3a2ce8a4c16d1100d))

## [0.4.1](https://github.com/bauer-group/CS-ScreenRecorder/compare/v0.4.0...v0.4.1) (2026-01-12)


### Bug Fixes

* **patches:** update branding script to replace absolute URLs with relative paths for middleware redirects ([453c901](https://github.com/bauer-group/CS-ScreenRecorder/commit/453c9016dce548ded9e4f7b363cf41155030290d))
* **patches:** update invite quota and seat limits to 10 million for self-hosted deployments ([4b19f11](https://github.com/bauer-group/CS-ScreenRecorder/commit/4b19f1149a74e17d646d71f6554a5a315e7ae209))

# [0.4.0](https://github.com/bauer-group/CS-ScreenRecorder/compare/v0.3.1...v0.4.0) (2026-01-12)


### Bug Fixes

* add Microsoft Entra ID authentication patch with necessary configurations ([f5cdda9](https://github.com/bauer-group/CS-ScreenRecorder/commit/f5cdda951eb83ba29d4d130db73ea43bf311308a))


### Features

* **patches:** implement patch to remove Stripe payment integration for self-hosted deployments ([5ed0820](https://github.com/bauer-group/CS-ScreenRecorder/commit/5ed082067535fa51747889637dd2df92a10df1e5))

## [0.3.1](https://github.com/bauer-group/CS-ScreenRecorder/compare/v0.3.0...v0.3.1) (2026-01-11)


### Bug Fixes

* Add options for using official Cap image in docker-compose ([2cf9fe7](https://github.com/bauer-group/CS-ScreenRecorder/commit/2cf9fe7f410fedd4ef0c9f1ec5bc1b8ad6eae1d7))
* Enhance debugging options in docker-compose for development ([2c3fcd3](https://github.com/bauer-group/CS-ScreenRecorder/commit/2c3fcd382cf3cff9d5f17cfc625f4a93c132ed1f))
* implement SMTP email support patch using AST-based modifications ([89f615b](https://github.com/bauer-group/CS-ScreenRecorder/commit/89f615b52fef04f73e1580048e6965ef41ae1629))
* **patches:** implement AST-based patches for Microsoft Entra ID authentication and URL redirects ([4062930](https://github.com/bauer-group/CS-ScreenRecorder/commit/4062930007c6438b00780b0f904e7bc77b07b702))
* Update CAP_VERSION to cap-v0.3.83 and adjust redirect status codes in middleware ([72118f8](https://github.com/bauer-group/CS-ScreenRecorder/commit/72118f80679a7b543bb800e99d6e8c924e34d252))
* Update Dockerfile to align Next.js build arguments with official Cap Dockerfile ([d0f3ea9](https://github.com/bauer-group/CS-ScreenRecorder/commit/d0f3ea99e928a7121ebe1f504db2c8a957128907))

# [0.3.0](https://github.com/bauer-group/CS-ScreenRecorder/compare/v0.2.0...v0.3.0) (2026-01-10)


### Bug Fixes

* Update CAP_VERSION to cap-v0.4.1 in configuration files ([4120c7a](https://github.com/bauer-group/CS-ScreenRecorder/commit/4120c7a6efbf929845ab9a3045dadaf67295f29c))
* Update user existence check to ensure current password is used in MinIO configuration scripts ([511bf7c](https://github.com/bauer-group/CS-ScreenRecorder/commit/511bf7c00bb40a2d90247258b76750824018566f))


### Features

* Update CAP_VERSION to cap-v0.4.2 in docker-compose; add Microsoft Entra ID authentication patch ([698c374](https://github.com/bauer-group/CS-ScreenRecorder/commit/698c37463ea1c077fb1f37b8c8ccbc1bb67db194))
* Update CAP_VERSION to cap-v0.4.2 in Dockerfile ([8a142a5](https://github.com/bauer-group/CS-ScreenRecorder/commit/8a142a5431b5083e53f33063a2fe82b9deb59350))

# [0.2.0](https://github.com/bauer-group/CS-ScreenRecorder/compare/v0.1.0...v0.2.0) (2026-01-10)


### Bug Fixes

* Add HTTP to HTTPS redirect middleware for MinIO in Traefik configuration ([fe47364](https://github.com/bauer-group/CS-ScreenRecorder/commit/fe473640a43ee45557f297a82da3fee78c5b96fe))
* Correct NextAuth secret length in secret generation script; ensure accurate entropy representation ([e368a4c](https://github.com/bauer-group/CS-ScreenRecorder/commit/e368a4c2ea49d6b33eb79de9033993d01f65d9bd))
* Update environment variable comments for CloudFront and integrations in Docker Compose files ([d575670](https://github.com/bauer-group/CS-ScreenRecorder/commit/d57567067d449e9e28ef41dadd790d29e0f9fdcd))
* Update healthcheck command and parameters in Docker Compose and Dockerfile for improved reliability ([3c082d2](https://github.com/bauer-group/CS-ScreenRecorder/commit/3c082d2e386ecd18ea18a2eca55f7fc8c8677e70))
* Update secret generation to avoid special characters; enhance security for NextAuth and database secrets ([c78f95d](https://github.com/bauer-group/CS-ScreenRecorder/commit/c78f95d187142606a7d2b158bff3546102c30276))


### Features

* Add bucket manager script for managing MinIO/S3 buckets; enhance client download URL documentation ([da306ac](https://github.com/bauer-group/CS-ScreenRecorder/commit/da306ac2dacfa1df9f8558f1321d09c83b9a222b))
* Add CAP_CLIENT_DOWNLOAD_URL to .env.example; update region for S3 client in setup and sync scripts; enhance redirect handling in middleware ([dfdc83a](https://github.com/bauer-group/CS-ScreenRecorder/commit/dfdc83a5c9793f7b51e51d3d82ad62018f60d698))
* Add custom URL redirects middleware for Next.js application ([5f9c69b](https://github.com/bauer-group/CS-ScreenRecorder/commit/5f9c69bd5e9e26085842a5dc8438e31541e29dcb))
* Add policy command to update IAM policies for MinIO users; enhance usage documentation ([88ab0ae](https://github.com/bauer-group/CS-ScreenRecorder/commit/88ab0aecf9e7ad76e7a0e5bc7470be792fb2145b))
* Add scripts for setting up and syncing client download bucket on MinIO ([ca95119](https://github.com/bauer-group/CS-ScreenRecorder/commit/ca951198d446ef090b1d04fe075ff6e6235b89d0))
* Update bucket naming and URL references; enhance HTML processing for downloads ([f119fcf](https://github.com/bauer-group/CS-ScreenRecorder/commit/f119fcf21ee44e1760bbfb5bc55cc513aa6f86f5))
* Update S3 bucket name from 'videos' to 'media' across configuration files ([4929e7a](https://github.com/bauer-group/CS-ScreenRecorder/commit/4929e7a9f7e20abca5bf4532b24f1bafc8fa7a0f))
* Update version numbers to cap-v0.4.1 in environment and Dockerfile; enhance sync script for CrabNebula CDN support ([3b8b195](https://github.com/bauer-group/CS-ScreenRecorder/commit/3b8b195fb116b33b50fd539cddc8c9cdfb9fadea))

# [0.1.0](https://github.com/bauer-group/CS-ScreenRecorder/compare/v0.0.0...v0.1.0) (2026-01-09)


### Bug Fixes

* Correct file paths and comments in Microsoft Entra ID authentication patch ([76f3d79](https://github.com/bauer-group/CS-ScreenRecorder/commit/76f3d79feddb1ec54e849366197a75f397707eee))
* Remove CAP_AWS_ACCESS_KEY from environment variables in Docker configurations ([d01b348](https://github.com/bauer-group/CS-ScreenRecorder/commit/d01b34859e835962b7203d05a02346edc134f316))


### Features

* Enhance SMTP support by adding checks for SMTP_HOST in auth-options.ts ([63ee387](https://github.com/bauer-group/CS-ScreenRecorder/commit/63ee3873d6464689cfcf15647f6cb4175d8c7d90))
* Update Dockerfile labels and enhance branding patch for color consistency ([b6f1f1b](https://github.com/bauer-group/CS-ScreenRecorder/commit/b6f1f1be6a991b23a298d2e72bbcc22847d26de6))
* Update LogoSpinner colors from blue to orange for branding consistency ([6bfe06c](https://github.com/bauer-group/CS-ScreenRecorder/commit/6bfe06c77403f34f969adc9ea5e8ae0cf570e06d))
