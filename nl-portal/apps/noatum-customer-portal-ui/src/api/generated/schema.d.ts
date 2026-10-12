export interface paths {
    "/api/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["HealthController_live"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/health/ready": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["HealthController_ready"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/integration/sync/{portalRef}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Every message exchanged for one business reference, newest first */
        get: operations["IntegrationSyncController_status"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/account/overview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["AccountController_overview"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/account/users": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["AccountController_users"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/account/role-presets": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["AccountController_rolePresets"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/account/invitations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["AccountController_invitations"];
        put?: never;
        post: operations["AccountController_invite"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/account/invitations/{id}/resend": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["AccountController_resend"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/account/invitations/{id}/revoke": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["AccountController_revoke"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/account/users/{id}/roles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch: operations["AccountController_changeRoles"];
        trace?: never;
    };
    "/api/account/users/{id}/deactivate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["AccountController_deactivate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/account/users/{id}/reactivate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["AccountController_reactivate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ai/quote-intake/availability": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["AiIntakeController_availability"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ai/quote-intake": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["AiIntakeController_quoteIntake"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/customers": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["CustomersController_list"];
        put?: never;
        post: operations["CustomersController_create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/customers/directory/organisations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["CustomersController_directory"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/customers/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["CustomersController_detail"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch: operations["CustomersController_update"];
        trace?: never;
    };
    "/api/admin/customers/{id}/go-live": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["CustomersController_goLive"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/customers/{id}/suspend": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["CustomersController_suspend"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/customers/{id}/close": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["CustomersController_close"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/customers/{id}/discard": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["CustomersController_discard"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/customers/{id}/organisations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["CustomersController_attach"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/customers/{id}/organisations/{accountId}/detach": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["CustomersController_detach"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/customers/{id}/organisations/{accountId}/servicing": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["CustomersController_setLinkServicing"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/customers/{id}/invitations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["CustomersController_invitations"];
        put?: never;
        post: operations["CustomersController_inviteAdministrator"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/customers/{id}/invitations/{invitationId}/resend": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["CustomersController_resendInvitation"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/customers/{id}/invitations/{invitationId}/revoke": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["CustomersController_revokeInvitation"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/customers/{id}/users": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["CustomersController_users"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/customers/{id}/users/{userId}/password-reset": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["CustomersController_sendPasswordReset"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/customers/{id}/users/{userId}/sign-in/block": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["CustomersController_blockSignIn"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/customers/{id}/users/{userId}/sign-in/restore": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["CustomersController_restoreSignIn"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/customers/{id}/users/{userId}/mfa/reset": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["CustomersController_resetUserMfa"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/customers/{id}/users/{userId}/organisations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["CustomersController_updateUserAccess"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/dashboard/analytics": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["DashboardController_analytics"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/quotes/{quoteId}/documents": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["DocumentsController_list"];
        put?: never;
        post: operations["DocumentsController_upload"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/quotes/{quoteId}/documents/internal": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Every document, including those the customer cannot see */
        get: operations["DocumentsController_listInternal"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/quotes/{quoteId}/documents/{documentId}/download": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** The file itself */
        get: operations["DocumentsController_download"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/quotes/{quoteId}/documents/{documentId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Removes a document and its stored object */
        delete: operations["DocumentsController_remove"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/feature-switches": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["FeaturesController_list"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/feature-switches/{key}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch: operations["FeaturesController_update"];
        trace?: never;
    };
    "/api/dev/users": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Development only: seeded identities for the local sign-in picker */
        get: operations["DevIdentityController_users"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["IdentityController_me"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/me/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["IdentityController_health"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/local/sign-in": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["LocalAuthController_signIn"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/local/sign-out": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["LocalAuthController_signOut"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/local/sign-out-everywhere": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["LocalAuthController_signOutEverywhere"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/local/mfa/verify": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["LocalAuthController_verifyMfa"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/local/mfa/enrolment": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["LocalAuthController_beginMfaEnrolment"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/local/mfa/enrolment/confirm": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["LocalAuthController_confirmMfaEnrolment"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/local/account": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["LocalAuthController_accountStatus"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/local/mfa/recovery-codes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["LocalAuthController_regenerateRecoveryCodes"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/local/mfa/replace": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["LocalAuthController_replaceMfa"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/local/mfa/remove": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["LocalAuthController_removeMfa"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/local/activation/{token}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["LocalAuthController_activationSubject"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/local/activation": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["LocalAuthController_activate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/local/bootstrap": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["LocalAuthController_completeBootstrap"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/local/password/reset-request": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["LocalAuthController_requestPasswordReset"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/local/password/reset": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["LocalAuthController_completeReset"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/local/password/change": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["LocalAuthController_changePassword"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/lookups/categories": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["LookupsController_categories"];
        put?: never;
        post: operations["LookupsController_createCategory"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/lookups/categories/{code}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch: operations["LookupsController_updateCategory"];
        trace?: never;
    };
    "/api/admin/lookups/categories/{code}/items": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["LookupsController_items"];
        put?: never;
        post: operations["LookupsController_createItem"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/lookups/categories/{code}/parent-options": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["LookupsController_parentOptions"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/lookups/items/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch: operations["LookupsController_updateItem"];
        trace?: never;
    };
    "/api/admin/operating/regions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["OperatingController_listRegions"];
        put?: never;
        post: operations["OperatingController_createRegion"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/operating/regions/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch: operations["OperatingController_updateRegion"];
        trace?: never;
    };
    "/api/admin/operating/branches": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["OperatingController_listBranches"];
        put?: never;
        post: operations["OperatingController_createBranch"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/operating/branches/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["OperatingController_branchDetail"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch: operations["OperatingController_updateBranch"];
        trace?: never;
    };
    "/api/admin/operating/cargowise-branches": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["OperatingController_listCargoWiseBranches"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/organisations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["OrganisationsController_list"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/organisations/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["OrganisationsController_detail"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/organisations/imports/runs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["OrganisationsController_runs"];
        put?: never;
        post: operations["OrganisationsController_runImport"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ports/search": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["PortsController_search"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/pricing/queue": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["PricingController_queue"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/pricing/quotations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["PricingController_quotations"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/pricing/quotes/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["PricingController_detail"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/pricing/quotes/{id}/claim": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["PricingController_claim"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/pricing/quotes/{id}/release": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["PricingController_release"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/pricing/quotes/{id}/force-release": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["PricingController_forceRelease"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/pricing/quotes/{id}/price": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["PricingController_price"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/pricing/quotes/{id}/assist": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["PricingController_assist"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/pricing/quotes/{id}/approve": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["PricingController_approve"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/pricing/quotes/{id}/send-back": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["PricingController_sendBack"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/pricing/quotes/{id}/publish": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["PricingController_publish"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/quotes/insights": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["QuotesController_quoteInsights"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/quotes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["QuotesController_list"];
        put?: never;
        post: operations["QuotesController_create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/quotes/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["QuotesController_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/quotes/{id}/rate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["QuotesController_rate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/quotes/{id}/submit": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["QuotesController_submit"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/quotes/{id}/accept": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["QuotesController_accept"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/quotes/{id}/decline": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["QuotesController_decline"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/quotes/{id}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["QuotesController_cancel"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/reference/{category}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["ReferenceController_items"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/settings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["SettingsController_list"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/settings/history": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["SettingsController_history"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/settings/{key}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["SettingsController_set"];
        delete: operations["SettingsController_clear"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/users/staff": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["UsersController_list"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/users/staff/role-presets": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["UsersController_presets"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/users/staff/branches": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["UsersController_branches"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/users/staff/{id}/roles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: operations["UsersController_updateRoles"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/users/staff/{id}/access-link": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["UsersController_accessLink"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        IntegrationMessageStatusDto: {
            id: string;
            /** @enum {string} */
            direction: "inbound" | "outbound";
            /**
             * @description pending is the normal resting state while no transport is configured: built and held, not lost. skipped means a switch told us not to send it.
             * @enum {string}
             */
            status: "pending" | "sending" | "sent" | "acknowledged" | "failed" | "skipped";
            /** @example quote.request.create */
            operation: string;
            attempts: number;
            lastError?: string | null;
            /** Format: date-time */
            sentAt?: string | null;
            externalReference?: string | null;
            /** Format: date-time */
            createdAt: string;
        };
        IntegrationSyncStatusDto: {
            /** @example Q-000042 */
            portalRef: string;
            /** @description False while the CargoWise transport is held, which is the case today. */
            transportConfigured: boolean;
            messages: components["schemas"]["IntegrationMessageStatusDto"][];
        };
        AccountOfficeDto: {
            id: string;
            name: string;
            cw1OrgCode: string;
            servicingBranchName: string | null;
        };
        AccountSetupStepDto: {
            /** @enum {string} */
            id: "profile" | "users" | "addresses" | "alerts" | "quote";
            done: boolean;
            /** @description False when the platform cannot yet observe this step, so the screen offers it without claiming to know whether it is finished. */
            trackable: boolean;
        };
        AccountContactDto: {
            name: string;
            role: string;
            email: string | null;
        };
        AccountRecordCountsDto: {
            shipments: number;
            quotations: number;
            invoices: number;
            bookings: number;
        };
        AccountOverviewDto: {
            customerName: string;
            legalName: string | null;
            countryCode: string | null;
            tier: string;
            /** @description Role names the viewer holds. */
            roleNames: string[];
            /** @description Permission codes the viewer holds; the screen shows a block only when its permission is present. */
            permissions: string[];
            offices: components["schemas"]["AccountOfficeDto"][];
            servicingBranchName: string | null;
            servicingBranchCode: string | null;
            signInEmail: string;
            /** @description Which identity provider this account signs in with. */
            signInMethod: string;
            setup: components["schemas"]["AccountSetupStepDto"][];
            /** @description Named Noatum contacts for this customer. Empty until contact assignment exists; the servicing branch above is what we can say today. */
            contacts: components["schemas"]["AccountContactDto"][];
            /** @description What is visible to this account right now. Real counts, not a progress estimate. */
            records: components["schemas"]["AccountRecordCountsDto"];
            /** @description Users on this customer, including those who have not accepted yet. */
            userCount: number;
            pendingInvitationCount: number;
        };
        AccountUserDto: {
            id: string;
            displayName: string;
            email: string;
            /** @enum {string} */
            status: "invited" | "active" | "disabled";
            roleKeys: string[];
            /** @description Display names for the same roles. */
            roleNames: string[];
            /** @description Null when the user sees every linked office. */
            officeName: string | null;
            lastLoginAt: string | null;
            /** @description True for the person making the request; the screen cannot let them lock themselves out. */
            isSelf: boolean;
        };
        AccountRolePresetDto: {
            key: string;
            name: string;
            description: string | null;
            /** @description What the role grants, for the "what can they do" line. */
            permissions: string[];
        };
        AccountInvitationDto: {
            id: string;
            email: string;
            displayName: string | null;
            /** @enum {string} */
            status: "pending" | "accepted" | "expired" | "revoked";
            roleKeys: string[];
            expiresAt: string;
            /** @description Resends used. Three is the maximum. */
            resendCount: number;
            invitedByName: string | null;
            createdAt: string;
            /** @description The single-use link, returned ONLY on creation and only while no email transport is configured, so an administrator can pass it on themselves. */
            inviteUrl: string | null;
        };
        InviteColleagueDto: {
            displayName: string;
            /** Format: email */
            email: string;
            /** @description At least one. */
            roleKeys: ("customer_standard" | "customer_quoting_booking" | "customer_finance" | "customer_analyst" | "customer_claims" | "customer_admin")[];
            /**
             * Format: uuid
             * @description Restrict to one linked office. Null means all of them.
             */
            officeAccountId?: string | null;
        };
        AccountActionReasonDto: {
            /** @description Audited. */
            reason: string;
        };
        ChangeRolesDto: {
            /** @description At least one. */
            roleKeys: ("customer_standard" | "customer_quoting_booking" | "customer_finance" | "customer_analyst" | "customer_claims" | "customer_admin")[];
            /** Format: uuid */
            officeAccountId?: string | null;
            /** @description Audited. */
            reason: string;
        };
        IntakeAvailabilityDto: {
            configured: boolean;
        };
        IntakeFileDto: {
            mimeType: string;
            dataBase64: string;
        };
        IntakeRequestDto: {
            /** @description Pasted enquiry text. */
            text?: string;
            file?: components["schemas"]["IntakeFileDto"];
            locale?: string;
        };
        IntakeDerivedDto: {
            rule: string;
            text: string;
        };
        IntakeQuestionDto: {
            id: string;
            field: string;
            ask: string;
        };
        IntakeDraftDto: {
            /** @enum {string} */
            status: "extracted" | "not-configured" | "unreadable";
            detail?: string;
            provenance: {
                [key: string]: unknown;
            };
            fields: {
                [key: string]: unknown;
            };
            derived: components["schemas"]["IntakeDerivedDto"][];
            questions: components["schemas"]["IntakeQuestionDto"][];
        };
        CustomerSummaryDto: {
            id: string;
            name: string;
            legalName: string | null;
            slug: string;
            /** @enum {string} */
            status: "draft" | "onboarding" | "active" | "suspended" | "closed";
            /** @enum {string} */
            tier: "basic" | "standard" | "premium";
            countryCode: string | null;
            parentName: string | null;
            linkedOrganisations: number;
            users: number;
            /** @description True when the customer is not live and cannot go live yet. */
            blocked: boolean;
            updatedAt: string;
        };
        CustomerListDto: {
            items: components["schemas"]["CustomerSummaryDto"][];
            total: number;
            page: number;
            pageSize: number;
        };
        DirectoryOrganisationDto: {
            id: string;
            sourceCode: string;
            sourceInstance: string;
            name: string;
            category: string | null;
            countryCode: string | null;
            city: string | null;
            isActive: boolean;
            /** @description Only a source-confirmed organisation may be linked. */
            isSourceConfirmed: boolean;
            sourceRoles: string[];
            /** @description Customer already holding this code. */
            linkedCustomerName: string | null;
            /** @description Why this organisation cannot be attached. */
            blockedReason: string | null;
        };
        DirectoryListDto: {
            items: components["schemas"]["DirectoryOrganisationDto"][];
            total: number;
            page: number;
            pageSize: number;
        };
        CustomerCreateDto: {
            name: string;
            legalName: string | null;
            slug: string;
            countryCode: string | null;
            /** @enum {string} */
            tier: "basic" | "standard" | "premium";
            emailDomains: string[];
            parentId: string | null;
            defaultServicingBranchId: string | null;
            reason: string;
        };
        CustomerTaskDto: {
            /** @enum {string} */
            key: "identity" | "entitlements" | "organisations" | "servicing" | "administrator" | "go_live";
            done: boolean;
            /** @description Why this task is not done yet. */
            blockedReason: string | null;
        };
        CustomerLinkDto: {
            id: string;
            orgId: string;
            sourceCode: string;
            name: string;
            countryCode: string | null;
            city: string | null;
            /** @description False when the organisation is inactive in CargoWise. */
            sourceActive: boolean;
            isActive: boolean;
            justification: string | null;
            linkedAt: string | null;
            /** @description Set on this link only; null means it follows the customer default. */
            servicingBranchCode: string | null;
            /** @description The office that actually services this link, after the customer default is applied. */
            effectiveServicingBranchCode: string | null;
            /** @description True when the office comes from the customer default rather than this link. */
            servicingInherited: boolean;
            addresses: number;
        };
        CustomerDetailDto: {
            id: string;
            name: string;
            legalName: string | null;
            slug: string;
            /** @enum {string} */
            status: "draft" | "onboarding" | "active" | "suspended" | "closed";
            /** @enum {string} */
            tier: "basic" | "standard" | "premium";
            countryCode: string | null;
            parentName: string | null;
            linkedOrganisations: number;
            users: number;
            /** @description True when the customer is not live and cannot go live yet. */
            blocked: boolean;
            updatedAt: string;
            emailDomains: string[];
            parentId: string | null;
            defaultServicingBranchId: string | null;
            defaultServicingBranchCode: string | null;
            tasks: components["schemas"]["CustomerTaskDto"][];
            links: components["schemas"]["CustomerLinkDto"][];
            /** @description Empty when the customer can go live. */
            goLiveMissing: string[];
            allowedTransitions: ("draft" | "onboarding" | "active" | "suspended" | "closed")[];
        };
        CustomerUpdateDto: {
            name: string;
            legalName: string | null;
            slug: string;
            countryCode: string | null;
            /** @enum {string} */
            tier: "basic" | "standard" | "premium";
            emailDomains: string[];
            parentId: string | null;
            defaultServicingBranchId: string | null;
            reason: string;
            /** @description The value last read, for optimistic concurrency. */
            updatedAt: string;
        };
        CustomerStatusChangeDto: {
            /** @description The value last read, for optimistic concurrency. */
            updatedAt: string;
            reason: string;
        };
        OrganisationLinkCreateDto: {
            orgId: string;
            servicingBranchId: string | null;
            reason: string;
        };
        OrganisationLinkRemoveDto: {
            reason: string;
        };
        OrganisationLinkServicingDto: {
            /** @description Null follows the customer default. */
            servicingBranchId: string | null;
            reason: string;
        };
        InvitationDto: {
            id: string;
            email: string;
            /** @enum {string} */
            status: "pending" | "accepted" | "expired" | "revoked";
            expiresAt: string;
            acceptedAt: string | null;
            invitedByName: string | null;
            createdAt: string;
            /** @enum {string} */
            emailStatus: "sent" | "queued" | "not-configured" | "failed";
            /** @description The single-use link, returned ONLY on creation and only while no email transport is configured, so staff can pass it on themselves. */
            inviteLink: string | null;
        };
        InviteAdministratorDto: {
            displayName: string;
            email: string;
            domainOverrideReason: string | null;
            reason: string;
        };
        AccountActionDto: {
            reason: string;
        };
        CustomerUserSecurityDto: {
            hasPassword: boolean;
            /** @description An administrator has blocked this password. */
            credentialDisabled: boolean;
            passwordSetAt: string | null;
            mfaEnrolled: boolean;
            recoveryCodesLeft: number;
            activeSessions: number;
            /** @description An unused activation link is still live. */
            pendingActivationLink: boolean;
        };
        CustomerUserDto: {
            id: string;
            displayName: string;
            email: string;
            status: string;
            lastLoginAt: string | null;
            /** @description True when no restriction rows exist, so the user sees every linked organisation. */
            seesAllOrganisations: boolean;
            accountIds: string[];
            security: components["schemas"]["CustomerUserSecurityDto"] | null;
        };
        CustomerUserListDto: {
            items: components["schemas"]["CustomerUserDto"][];
            total: number;
            page: number;
            pageSize: number;
        };
        AccountActionResultDto: {
            /** @description False when there was nothing to do - already disabled, no factor to clear. */
            changed: boolean;
            /** @enum {string|null} */
            emailStatus: "sent" | "queued" | "not-configured" | "failed" | null;
            /** @description The single-use link, returned only while no email transport is configured so staff can pass it on. Never stored. */
            link: string | null;
        };
        UserAccessUpdateDto: {
            /** @enum {string} */
            scope: "all" | "selected";
            accountIds: string[];
            reason: string;
        };
        DashboardActionDto: {
            /** @description Stable key, e.g. "quote_decision". Picks the icon and the wording. */
            key: string;
            title: string;
            detail: string;
            /** @description The deadline or state, e.g. "Expires in 10 days". */
            badge: string;
            /**
             * @description How urgent the badge reads. Never the only signal - the text says it too.
             * @enum {string}
             */
            tone: "action" | "warning" | "info" | "neutral";
            /** @description What the customer does about it, e.g. "Review". */
            cta: string;
            /** @description In-app path. Empty when the destination has not shipped. */
            href: string;
        };
        DashboardKpiDto: {
            /** @description One of shipments | on_time | door_to_door | spend | balance. */
            key: string;
            /** @description Already formatted, e.g. "EUR 384k" or "30.3". The server owns rounding. */
            value: string;
            /** @description e.g. "days". Null when the value carries its own. */
            unit: string | null;
            /** @description e.g. "17%" or "3.8 pts". Null when there is nothing to compare with. */
            delta: string | null;
            /**
             * @description Direction of travel only. Whether up is good is the tile's business, not the arrow's.
             * @enum {string}
             */
            deltaDirection: "up" | "down" | "flat" | "none";
            /**
             * @description What the change means for the customer, decided here so the screen never guesses.
             * @enum {string}
             */
            deltaTone: "good" | "bad" | "neutral";
            /** @description The quiet line, e.g. "vs prior 12 months" or "target 90%". */
            caption: string | null;
            /** @description The sparkline, oldest first. Empty when there is no history. */
            spark: number[];
        };
        DashboardMonthDto: {
            /** @description First day of the month, ISO date. */
            month: string;
            seaFcl: number;
            seaLcl: number;
            air: number;
            /** @description Minor units of the dashboard currency. */
            spendMinorUnits: number;
        };
        DashboardModeSliceDto: {
            /** @enum {string} */
            mode: "sea_fcl" | "sea_lcl" | "air";
            shipments: number;
            spendMinorUnits: number;
        };
        DashboardStageDto: {
            /** @description One of booked | at_origin | in_transit | at_destination | in_customs. */
            key: string;
            count: number;
        };
        DashboardArrivalDto: {
            /** @description ISO date of the expected arrival or next event. */
            date: string;
            /** @description Container, booking or air waybill reference. */
            reference: string;
            /** @description e.g. "CNTAO to ESVLC · 40 HC". */
            lane: string;
            /** @description The one sentence that says where it is. */
            note: string;
            status: string;
            /** @enum {string} */
            tone: "good" | "warning" | "action" | "neutral";
        };
        DashboardInFlightDto: {
            stages: components["schemas"]["DashboardStageDto"][];
            arrivingNext: components["schemas"]["DashboardArrivalDto"][];
            /** @description Delivered in the last 30 days, for the caption. */
            deliveredRecently: number;
        };
        DashboardOnTimePointDto: {
            month: string;
            /** @description Whole percent arrived inside the quoted window. */
            percent: number;
        };
        DashboardOnTimeDto: {
            percent: number;
            targetPercent: number;
            monthsOnTarget: number;
            points: components["schemas"]["DashboardOnTimePointDto"][];
        };
        DashboardTransitDto: {
            /** @description e.g. "CNTAO to ESVLC". */
            lane: string;
            /** @description The transit a pricing specialist quoted, in days. */
            quotedMinDays: number;
            quotedMaxDays: number;
            /** @description What actually happened, fastest and slowest. */
            actualMinDays: number;
            actualMaxDays: number;
            averageDays: number;
        };
        DashboardLaneDto: {
            originCode: string;
            originName: string;
            destinationCode: string;
            destinationName: string;
            /** @enum {string} */
            mode: "sea_fcl" | "sea_lcl" | "air";
            shipments: number;
            averageTransitDays: number;
            quotedMinDays: number;
            quotedMaxDays: number;
            onTimePercent: number;
            spendMinorUnits: number;
            /** @description Spend by month on this lane, oldest first. */
            trend: number[];
            /** @description Share of total spend, whole percent. */
            sharePercent: number;
        };
        DashboardSpendSliceDto: {
            /** @description Charge group key, e.g. "freight". Mapped, never a CargoWise code. */
            key: string;
            label: string;
            amountMinorUnits: number;
            percent: number;
            /**
             * @description Which rail colour the slice takes. Avoidable cost is drawn in the action colour.
             * @enum {string}
             */
            tone: "primary" | "info" | "neutral" | "warning" | "action";
        };
        DashboardSpendDto: {
            totalMinorUnits: number;
            slices: components["schemas"]["DashboardSpendSliceDto"][];
            /** @description The one thing worth saying about the split, e.g. what demurrage cost and why. */
            note: string | null;
        };
        DashboardAgeingBucketDto: {
            /** @description current | 1_30 | 31_60 | 61_90 | 90_plus. */
            bucket: string;
            amountMinorUnits: number;
        };
        DashboardInvoicesDto: {
            openMinorUnits: number;
            /** @description Payment terms in days, for the caption. */
            termsDays: number;
            ageing: components["schemas"]["DashboardAgeingBucketDto"][];
            creditUsedMinorUnits: number;
            creditLimitMinorUnits: number;
            /** @description Overdue past terms, the figure the balance tile warns on. */
            overdueMinorUnits: number;
        };
        DashboardEmissionMonthDto: {
            month: string;
            /** @description Tonnes of CO2e. */
            tonnes: number;
        };
        DashboardEmissionModeDto: {
            /** @enum {string} */
            mode: "sea_fcl" | "sea_lcl" | "air";
            /** @description Share of total emissions, whole percent. */
            percent: number;
        };
        DashboardEmissionsDto: {
            totalTonnes: number;
            /** @description The methodology, e.g. "Well to wheel, GLEC-aligned estimate". */
            basis: string;
            monthly: components["schemas"]["DashboardEmissionMonthDto"][];
            byMode: components["schemas"]["DashboardEmissionModeDto"][];
            /** @description The comparison worth making, e.g. air being a small share of moves and a large share of carbon. */
            note: string | null;
        };
        DashboardAnalyticsDto: {
            /** @description When the figures were last refreshed from the system of record. */
            asOf: string;
            /**
             * @description Where these figures came from. `sample` means generated for a pilot environment and must be said so on screen - a customer reading an invented spend as their own is the failure this field exists to prevent.
             * @enum {string}
             */
            source: "cargowise" | "sample";
            /** @enum {string} */
            period: "3m" | "6m" | "12m";
            /** @enum {string} */
            mode: "all" | "sea_fcl" | "sea_lcl" | "air";
            /** @description ISO 4217, e.g. EUR. Every minor-unit figure on this DTO is in it. */
            currency: string;
            customerName: string;
            /** @description The viewer's first name, for the greeting. */
            firstName: string;
            /** @description Offices this account sees, for the subtitle. */
            officeNames: string[];
            /** @description In flight right now, across every mode. */
            inFlightCount: number;
            /** @description Arriving in the next ten days. */
            arrivingSoonCount: number;
            actions: components["schemas"]["DashboardActionDto"][];
            kpis: components["schemas"]["DashboardKpiDto"][];
            monthly: components["schemas"]["DashboardMonthDto"][];
            modeMix: components["schemas"]["DashboardModeSliceDto"][];
            inFlight: components["schemas"]["DashboardInFlightDto"];
            onTime: components["schemas"]["DashboardOnTimeDto"];
            transit: components["schemas"]["DashboardTransitDto"][];
            lanes: components["schemas"]["DashboardLaneDto"][];
            spend: components["schemas"]["DashboardSpendDto"];
            invoices: components["schemas"]["DashboardInvoicesDto"];
            emissions: components["schemas"]["DashboardEmissionsDto"];
        };
        UploadQuoteDocumentDto: {
            /** @enum {string} */
            documentType: "packing_list" | "safety_data_sheet" | "dangerous_goods_declaration" | "commercial_invoice" | "cargo_photo" | "other_supporting" | "quotation" | "terms_and_conditions";
            /** @enum {string} */
            direction: "from_customer" | "to_customer";
            /** @description Only meaningful on to_customer. Defaults to true. */
            customerVisible?: boolean;
            /** Format: binary */
            file: string;
        };
        InternalQuoteDocumentDto: {
            /** Format: uuid */
            id: string;
            /** @enum {string} */
            documentType: "packing_list" | "safety_data_sheet" | "dangerous_goods_declaration" | "commercial_invoice" | "cargo_photo" | "other_supporting" | "quotation" | "terms_and_conditions";
            /** @enum {string} */
            direction: "from_customer" | "to_customer";
            /** @example packing-list.pdf */
            filename: string;
            /** @example application/pdf */
            contentType: string;
            sizeBytes: number;
            /** Format: date-time */
            uploadedAt: string;
            uploadedByName?: string | null;
            /** @description False means the customer cannot see this document at all. */
            customerVisible: boolean;
        };
        QuoteDocumentDto: {
            /** Format: uuid */
            id: string;
            /** @enum {string} */
            documentType: "packing_list" | "safety_data_sheet" | "dangerous_goods_declaration" | "commercial_invoice" | "cargo_photo" | "other_supporting" | "quotation" | "terms_and_conditions";
            /** @enum {string} */
            direction: "from_customer" | "to_customer";
            /** @example packing-list.pdf */
            filename: string;
            /** @example application/pdf */
            contentType: string;
            sizeBytes: number;
            /** Format: date-time */
            uploadedAt: string;
            uploadedByName?: string | null;
        };
        FeatureSwitchDto: {
            /** @enum {string} */
            key: "organisations.import.file" | "organisations.import.feed" | "organisations.manual_entry" | "organisations.contacts.import" | "lookups.type_creation" | "access.impersonation" | "communication.ai_drafting" | "quotations.instant_rate" | "quotations.dangerous_goods" | "quotations.portal_pricing" | "quotations.multi_option" | "quotations.cw1_request_sync" | "quotations.ai_intake" | "pricing.ai_assist" | "documents.customer_upload" | "documents.quote_answer" | "dashboard.analytics";
            /** @enum {string} */
            category: "organisations" | "lookups" | "access" | "communication" | "quotations" | "documents" | "dashboard";
            /** @description English fallback; the client translates by key. */
            label: string;
            description: string;
            enabled: boolean;
            defaultEnabled: boolean;
            /** @description False while the switch sits at its code default. */
            overridden: boolean;
            /** @description Turning this on needs a recorded approval reference. */
            requiresApproval: boolean;
            approvalReference: string | null;
            reason: string | null;
            updatedBy: string | null;
            /** Format: date-time */
            updatedAt: string | null;
        };
        ProtectedCapabilityDto: {
            id: string;
            label: string;
            reason: string;
        };
        FeatureSwitchListDto: {
            switches: components["schemas"]["FeatureSwitchDto"][];
            /** @description Invariants that are deliberately not switches. */
            protected: components["schemas"]["ProtectedCapabilityDto"][];
        };
        FeatureSwitchUpdateDto: {
            enabled: boolean;
            reason: string;
            approvalReference: string | null;
        };
        DevIdentityDto: {
            subject: string;
            /** Format: email */
            email: string;
            displayName: string;
            /** @enum {string} */
            status: "registered" | "invited" | "active" | "suspended" | "disabled";
            roleKeys: string[];
        };
        DevIdentityListDto: {
            enabled: boolean;
            users: components["schemas"]["DevIdentityDto"][];
        };
        CurrentUserDto: {
            /** Format: uuid */
            userId: string;
            displayName: string;
            /** Format: email */
            email: string;
            branchCode: string | null;
            branchName: string | null;
            roleKeys: string[];
            /** Format: uuid */
            customerGroupId: string | null;
            isInternal: boolean;
            /** Format: uuid */
            onBehalfOfUserId: string | null;
            accountIds: string[];
            permissions: string[];
            features: string[];
            settings: {
                [key: string]: boolean | number | string;
            };
        };
        LocalLoginDto: {
            email: string;
            password: string;
            /** @enum {string} */
            audience?: "customer" | "staff";
        };
        LocalSessionDto: {
            /**
             * @description authenticated: done. mfa_required: a code is needed. mfa_enrolment_required: a second factor must be set up before anything else.
             * @enum {string}
             */
            state: "authenticated" | "mfa_required" | "mfa_enrolment_required";
            email: string;
            displayName: string;
            /** @description Send this in x-csrf-token on every state-changing request. */
            csrfToken: string;
        };
        LocalSignOutEverywhereDto: {
            /** @description Sessions ended besides the one that asked. Zero is a normal answer, not a failure: it means this was the only session. */
            revoked: number;
        };
        LocalMfaVerifyDto: {
            code?: string;
            recoveryCode?: string;
        };
        LocalMfaEnrolmentDto: {
            /** @description Base32 secret, for keying in by hand. */
            secret: string;
            /** @description otpauth:// URI for the QR code. */
            uri: string;
        };
        LocalMfaConfirmDto: {
            code: string;
        };
        LocalRecoveryCodesDto: {
            /** @description Shown once. Only hashes are kept, so this list cannot be re-issued. */
            codes: string[];
        };
        LocalAccountStatusDto: {
            email: string;
            displayName: string;
            hasPassword: boolean;
            passwordSetAt: string | null;
            mfaEnrolled: boolean;
            /** @description Unused recovery codes left. Below three is worth acting on. */
            recoveryCodesLeft: number;
            /** @description Including this one. */
            activeSessions: number;
            /** @description True when a second factor cannot be removed, only replaced. */
            mfaRequired: boolean;
            csrfToken: string;
        };
        LocalPasswordConfirmDto: {
            currentPassword: string;
        };
        LocalActivationSubjectDto: {
            email: string;
            displayName: string;
        };
        LocalActivateDto: {
            token: string;
            password: string;
        };
        LocalPasswordResetRequestDto: {
            email: string;
        };
        LocalPasswordChangeDto: {
            currentPassword: string;
            newPassword: string;
        };
        LookupCategoryDto: {
            /** Format: uuid */
            id: string;
            code: string;
            name: string;
            description: string | null;
            /** @enum {string} */
            ownership: "portal" | "source" | "system";
            sourceSystem: string | null;
            /** @description Where the seeded content came from. */
            sourceRef: string | null;
            /** @description Category an item parent must belong to. Null means flat. */
            parentCategoryCode: string | null;
            isActive: boolean;
            sortOrder: number;
            metadata: {
                [key: string]: unknown;
            } | null;
            /** @description False for source and system lists: their content is owned elsewhere. */
            canEditContent: boolean;
            /** @description Whether values here may be activated or retired. True for portal and source lists; false for system lists, which mirror application enums. */
            canRetire: boolean;
            itemCount: number;
            /** @description Items reachable by a customer surface. */
            customerVisibleCount: number;
            /** @description Locales with a label on every item. */
            completeLocales: string[];
            /** Format: date-time */
            lastChangedAt: string | null;
        };
        LookupCategoryCreateDto: {
            code: string;
            name: string;
            description: string | null;
            /** @description Its own code makes the list self-nesting. */
            parentCategoryCode: string | null;
            sortOrder: number;
            metadata: {
                [key: string]: unknown;
            } | null;
            reason: string;
        };
        LookupCategoryUpdateDto: {
            name: string;
            description: string | null;
            parentCategoryCode: string | null;
            sortOrder: number;
            metadata: {
                [key: string]: unknown;
            } | null;
            isActive: boolean;
            reason: string;
        };
        LookupTranslationDto: {
            /** @enum {string} */
            locale: "en-US" | "es-ES";
            label: string;
            description: string | null;
        };
        LookupItemDto: {
            /** Format: uuid */
            id: string;
            code: string;
            /** @description One entry per maintained locale. */
            translations: components["schemas"]["LookupTranslationDto"][];
            parentCode: string | null;
            parentLabel: string | null;
            isActive: boolean;
            isCustomerVisible: boolean;
            sourceRef: string | null;
            metadata: {
                [key: string]: unknown;
            } | null;
            sortOrder: number;
            version: number;
            /** Format: date-time */
            updatedAt: string;
        };
        LookupItemListDto: {
            category: components["schemas"]["LookupCategoryDto"];
            items: components["schemas"]["LookupItemDto"][];
            total: number;
            page: number;
            pageSize: number;
        };
        LookupItemCreateDto: {
            code: string;
            parentCode: string | null;
            sortOrder: number;
            isActive: boolean;
            isCustomerVisible: boolean;
            metadata: {
                [key: string]: unknown;
            } | null;
            translations: components["schemas"]["LookupTranslationDto"][];
            reason: string;
        };
        LookupItemUpdateDto: {
            parentCode: string | null;
            sortOrder: number;
            isActive: boolean;
            isCustomerVisible: boolean;
            metadata: {
                [key: string]: unknown;
            } | null;
            translations: components["schemas"]["LookupTranslationDto"][];
            version: number;
            reason: string;
        };
        RegionDto: {
            /** Format: uuid */
            id: string;
            code: string;
            name: string;
            isActive: boolean;
            /** @description Branches grouped under this region. */
            branchCount: number;
            createdAt: string;
            updatedAt: string;
        };
        RegionListDto: {
            items: components["schemas"]["RegionDto"][];
            total: number;
            page: number;
            pageSize: number;
        };
        RegionCreateDto: {
            code: string;
            name: string;
        };
        RegionUpdateDto: {
            name?: string;
            isActive?: boolean;
            /** Format: date-time */
            updatedAt: string;
        };
        BranchDto: {
            /** Format: uuid */
            id: string;
            code: string;
            name: string;
            city: string | null;
            countryCode: string | null;
            /** Format: uuid */
            regionId: string | null;
            regionName: string | null;
            /** @description CargoWise ControllingBranch mapping. */
            sourceBranchCode: string | null;
            /** @description Where the record came from: 'manual' until an authoritative import exists. */
            source: string;
            isActive: boolean;
            /** @description Staff assigned to this branch. */
            staffCount: number;
            /** @description Active customer links this branch services. */
            servicedCount: number;
            createdAt: string;
            updatedAt: string;
        };
        BranchListDto: {
            items: components["schemas"]["BranchDto"][];
            total: number;
            page: number;
            pageSize: number;
        };
        BranchCreateDto: {
            code: string;
            name: string;
            city?: string | null;
            countryCode?: string | null;
            /** Format: uuid */
            regionId?: string | null;
            sourceBranchCode?: string | null;
        };
        BranchUpdateDto: {
            name?: string;
            city?: string | null;
            countryCode?: string | null;
            /** Format: uuid */
            regionId?: string | null;
            sourceBranchCode?: string | null;
            isActive?: boolean;
            /** Format: date-time */
            updatedAt: string;
        };
        CargoWiseBranchDto: {
            /** @description CargoWise ControllingBranch code seen on imported organisations. */
            cw1Code: string;
            /** @description Active organisations carrying this controlling branch. */
            organisationCount: number;
            /** Format: uuid */
            mappedBranchId: string | null;
            mappedBranchCode: string | null;
            mappedBranchName: string | null;
        };
        CargoWiseBranchListDto: {
            items: components["schemas"]["CargoWiseBranchDto"][];
            total: number;
        };
        OrganisationRowDto: {
            id: string;
            sourceCode: string;
            sourceInstance: string;
            name: string;
            category: string | null;
            countryCode: string | null;
            city: string | null;
            /** @enum {string} */
            sourceKind: "feed" | "file" | "manual";
            isActive: boolean;
            isSourceConfirmed: boolean;
            sourceRoles: string[];
            addresses: number;
            linkedCustomerId: string | null;
            linkedCustomerName: string | null;
            lastSeenAt: string | null;
        };
        OrganisationListDto: {
            items: components["schemas"]["OrganisationRowDto"][];
            total: number;
            page: number;
            pageSize: number;
        };
        OrganisationAddressTypeDto: {
            /** @description The CargoWise AddressType code. */
            code: string;
            /** @description Null when the code is not in the catalogue yet. */
            label: string | null;
        };
        OrganisationAddressDto: {
            id: string;
            sourceAddressCode: string;
            /** @description What the address is used for. */
            purposes: components["schemas"]["OrganisationAddressTypeDto"][];
            isPrimary: boolean;
            companyNameOverride: string | null;
            addressLine1: string | null;
            city: string | null;
            state: string | null;
            postcode: string | null;
            countryCode: string | null;
            /** @description UN/LOCODE. */
            relatedPortCode: string | null;
            isActive: boolean;
        };
        OrganisationRegistrationDto: {
            id: string;
            scheme: string;
            schemeDescription: string | null;
            value: string;
            jurisdiction: string | null;
            isCountryDefault: boolean;
        };
        OrganisationChangeDto: {
            id: string;
            changeType: string;
            createdAt: string;
            runKind: string | null;
            runFileName: string | null;
        };
        OrganisationDetailDto: {
            id: string;
            sourceCode: string;
            sourceInstance: string;
            name: string;
            category: string | null;
            countryCode: string | null;
            city: string | null;
            /** @enum {string} */
            sourceKind: "feed" | "file" | "manual";
            isActive: boolean;
            isSourceConfirmed: boolean;
            sourceRoles: string[];
            addresses: number;
            linkedCustomerId: string | null;
            linkedCustomerName: string | null;
            lastSeenAt: string | null;
            legalName: string | null;
            state: string | null;
            postcode: string | null;
            /** @description CargoWise ControllingBranch, not the Noatum office. */
            sourceBranchCode: string | null;
            /** @description Evidence only; grants no access. */
            sourceControllingCustomerCode: string | null;
            firstSeenAt: string | null;
            linkedAt: string | null;
            linkJustification: string | null;
            /** @description Office servicing this link, after the customer default is applied. */
            linkServicingBranchCode: string | null;
            /** @description True when the office comes from the customer default rather than this link. */
            linkServicingInherited: boolean;
            addressList: components["schemas"]["OrganisationAddressDto"][];
            registrations: components["schemas"]["OrganisationRegistrationDto"][];
            history: components["schemas"]["OrganisationChangeDto"][];
        };
        ImportRunDto: {
            id: string;
            /** @enum {string} */
            outcome: "running" | "succeeded" | "failed" | "aborted";
            sourceInstance: string;
            mode: string;
            isAuthoritative: boolean;
            fileName: string | null;
            rowsRead: number;
            rowsCreated: number;
            rowsUpdated: number;
            rowsUnchanged: number;
            rowsDeactivated: number;
            rowsRejected: number;
            startedByName: string | null;
            startedAt: string;
            finishedAt: string | null;
            /** @description Rejections and any refusal by the deactivation brake. */
            errors: Record<string, never>;
        };
        ImportRunListDto: {
            items: components["schemas"]["ImportRunDto"][];
            total: number;
        };
        ImportRunRequestDto: {
            /** @description True only for a complete snapshot that may deactivate absent organisations. */
            authoritative: boolean;
            reason: string;
        };
        PortDto: {
            /**
             * @description UN/LOCODE. Store this, not the name.
             * @example ESVLC
             */
            code: string;
            /** @example Valencia */
            name: string;
            /**
             * @description ISO 3166-1 alpha-2.
             * @example ES
             */
            countryCode: string;
            /**
             * @description Country name for the caller locale, from the country lookup. Null if that lookup has no row for the code.
             * @example Spain
             */
            countryName: string | null;
            /** @description ISO 3166-2 subdivision, where the directory records one. */
            subdivision: string | null;
            /** @description Handles sea freight. */
            isSeaport: boolean;
            /** @description Handles air freight. */
            isAirport: boolean;
        };
        PricingQueueEntryDto: {
            /** Format: uuid */
            id: string;
            reference: string;
            /** @enum {string} */
            status: "draft" | "requested" | "claimed" | "priced" | "approved" | "published" | "submitted" | "quoted" | "pending_sync" | "rated" | "rate_failed" | "expired" | "accepted" | "rejected" | "withdrawn";
            /** @enum {string} */
            mode: "air" | "sea" | "road" | "rail";
            originCode: string;
            destinationCode: string;
            customerName: string | null;
            /** Format: date-time */
            createdAt: string;
            /** Format: uuid */
            claimedById: string | null;
            /** Format: date-time */
            claimedAt: string | null;
            claimedByName: string | null;
            /**
             * Format: date-time
             * @description Null when unclaimed. Lets the screen count down without re-deriving the setting.
             */
            claimExpiresAt: string | null;
            /** @description True when the acting user holds the claim. */
            claimedByMe: boolean;
        };
        QuoteCargoUnitDto: {
            quantity: number;
            /** @description container_type lookup code, e.g. 40HC. */
            containerType: string;
        };
        QuoteCargoDto: {
            /** @description Empty unless a full-load request. */
            units: components["schemas"]["QuoteCargoUnitDto"][];
            grossWeightKg: number | null;
            volumeM3: number | null;
            /** @description load_type lookup code, e.g. LCL. */
            loadType: string | null;
            /** @description What is being moved, as submitted. */
            commodity: string | null;
        };
        PricingQuotationDto: {
            /** Format: uuid */
            id: string;
            reference: string;
            /** @enum {string} */
            status: "draft" | "requested" | "claimed" | "priced" | "approved" | "published" | "submitted" | "quoted" | "pending_sync" | "rated" | "rate_failed" | "expired" | "accepted" | "rejected" | "withdrawn";
            /** @enum {string} */
            mode: "air" | "sea" | "road" | "rail";
            originCode: string;
            destinationCode: string;
            customerName: string | null;
            /** Format: date-time */
            createdAt: string;
            /** Format: uuid */
            claimedById: string | null;
            /** Format: date-time */
            claimedAt: string | null;
            claimedByName: string | null;
            /**
             * Format: date-time
             * @description Null when unclaimed. Lets the screen count down without re-deriving the setting.
             */
            claimExpiresAt: string | null;
            /** @description True when the acting user holds the claim. */
            claimedByMe: boolean;
            /** @description The customer's own reference. */
            customerReference: string | null;
            /** @description Servicing office for this customer. The quiet second line under the name. */
            customerBranchName: string | null;
            /** @description How many quotations this customer has in total. Context, not a filter. */
            customerQuoteCount: number;
            cargo: components["schemas"]["QuoteCargoDto"];
            /** @description Minor units. Null until priced. */
            totalMinorUnits: number | null;
            currency: string | null;
            /** @description Priced options on this quote. */
            optionCount: number;
            /** Format: date-time */
            validUntil: string | null;
            /** @description Whole days until the offer lapses, floored. Null when nothing is published. */
            daysRemaining: number | null;
            /** @enum {string} */
            pipelineSegment: "submitted" | "in_progress" | "options_ready" | "expiring_soon" | "accepted" | "declined" | "expired";
            /** @description Initials of whoever holds the work. Null when nobody does. */
            ownerInitials: string | null;
            /** @description Sell minus cost over sell, one decimal. Null unless cost capture is on, the caller holds pricing.cost.view, and a cost was actually recorded - it is never stored, only derived. */
            marginPercent: number | null;
        };
        QuotePipelineSegmentDto: {
            /** @enum {string} */
            key: "submitted" | "in_progress" | "options_ready" | "expiring_soon" | "accepted" | "declined" | "expired";
            count: number;
        };
        PricingQuotationListDto: {
            items: components["schemas"]["PricingQuotationDto"][];
            total: number;
            /** @description Counted across the branch, ignoring the segment filter itself. */
            pipeline: components["schemas"]["QuotePipelineSegmentDto"][];
            /** @description Quotations in the branch that nobody has claimed. */
            unclaimed: number;
            /** @description Whether the margin column carries anything for this caller. False hides it rather than printing a column of dashes. */
            maySeeMargin: boolean;
        };
        DangerousGoodsEntryDto: {
            /** Format: uuid */
            id: string;
            /** @description Order as entered, from 1. */
            position: number;
            /** @example 1263 */
            unNumber: string;
            /**
             * @description Class or division code.
             * @example 3
             */
            hazardClass: string;
            properShippingName: string;
            /** @description Further hazards the substance also presents. */
            subsidiaryRisks: string[];
            /** @description 'NONE' where the entry is not assigned one. */
            packingGroup: string | null;
            technicalName: string | null;
            flashpointCelsius: number | null;
            emsCode: string | null;
            isMarinePollutant: boolean;
            packagingType: string | null;
            /** @description UN packaging code, e.g. 1A1. */
            unPackagingCode: string | null;
            packageCount: number | null;
            netQuantityPerPackage: number | null;
            quantityUnit: string | null;
            transportRegime: string | null;
            isInOverpack: boolean;
            /** @description lineId values from payload.packages - which cargo holds this entry. */
            appliesToLines: string[];
            notes: string | null;
        };
        QuoteEquipmentDto: {
            /** Format: uuid */
            id: string;
            /** @description Order as entered, from 1. */
            position: number;
            /** @description Stable id within the request; dangerous goods entries name it. */
            unitId: string;
            /**
             * @description container_type lookup code.
             * @example 40HC
             */
            containerType: string;
            quantity: number;
            /** @description Expected load per container. Indicative; the CSC plate binds. */
            grossWeightPerUnitKg: number | null;
            notes: string | null;
        };
        TemperatureControlDto: {
            /** Format: uuid */
            id: string;
            /** @description Celsius. Negative is ordinary. */
            setPointCelsius: number;
            /** @description Plus or minus. Zero means none, which differs from not stated. */
            toleranceCelsius: number | null;
            /** @description reefer_ventilation lookup code. */
            ventilation: string | null;
            controlledAtmosphere: boolean;
            preCoolingRequired: boolean;
            /** @description reefer_data_logger lookup code. */
            dataLogger: string | null;
            notes: string | null;
        };
        OversizeItemDto: {
            /** Format: uuid */
            id: string;
            position: number;
            description: string;
            lengthCm: number;
            widthCm: number;
            heightCm: number;
            weightKg: number;
            /** @description lifting_method lookup code. */
            liftingMethod: string | null;
            notes: string | null;
        };
        QuoteChargeLineDto: {
            /** Format: uuid */
            id: string;
            position: number;
            code: string | null;
            description: string;
            basis: string | null;
            quantity: number;
            /** @description Minor units. */
            rateMinorUnits: number;
            currency: string;
            /** @description quantity x rate, computed by the API. */
            amountMinorUnits: number;
            /** @description Internal cost PER UNIT, mirroring rateMinorUnits beside it. Absent unless costCapture is on AND the caller holds pricing.cost.view. */
            costMinorUnits: number | null;
        };
        QuoteOptionDto: {
            /** Format: uuid */
            id: string;
            position: number;
            name: string | null;
            carrierName: string | null;
            serviceRouting: string | null;
            transitDaysMin: number | null;
            transitDaysMax: number | null;
            nextDepartures: string | null;
            /** @description Free time at destination, in days. */
            freeTimeDays: number | null;
            /** @description Sum of the charge lines, minor units. */
            totalMinorUnits: number | null;
            currency: string | null;
            /** Format: date-time */
            validUntil: string | null;
            isRecommended: boolean;
            notes: string | null;
            termsIncluded: string | null;
            termsExcluded: string | null;
            termsPayment: string | null;
            termsSubjectTo: string | null;
            chargeLines: components["schemas"]["QuoteChargeLineDto"][];
            /** @description Internal cost total. Null when not permitted. */
            costTotalMinorUnits: number | null;
            /** @description Derived, never stored: (sell - cost) / sell as a percentage. Null when cost is not permitted. */
            marginPercent: number | null;
        };
        ReferenceItemDto: {
            /** @description Stable code. Store this, not the label. */
            code: string;
            /** @description Translated for the caller's locale. */
            label: string;
            description: string | null;
            metadata: {
                [key: string]: unknown;
            } | null;
        };
        PricingQuoteDto: {
            /** Format: uuid */
            id: string;
            reference: string;
            /** @enum {string} */
            status: "draft" | "requested" | "claimed" | "priced" | "approved" | "published" | "submitted" | "quoted" | "pending_sync" | "rated" | "rate_failed" | "expired" | "accepted" | "rejected" | "withdrawn";
            /** @description Customer-visible. Bumped when a published quote is re-priced. */
            version: number;
            /** @enum {string} */
            mode: "air" | "sea" | "road" | "rail";
            originCode: string;
            destinationCode: string;
            /** @description FCL, LCL, FTL or LTL. Null where the mode carries no load type. */
            loadType: string | null;
            /** @description From the port directory, so the lane can read Qingdao and not only CNTAO. */
            originName: string | null;
            destinationName: string | null;
            incoterm: string | null;
            /** Format: date-time */
            readyDate: string | null;
            customerReference: string | null;
            serviceLevel: string | null;
            /** @description The currency the customer asked to be quoted in. A new option starts here. */
            currency: string;
            customerName: string | null;
            /** @description The account the request was raised against, e.g. "Valencia office". */
            accountName: string | null;
            /** @description That account's CargoWise organisation code. Resolved here, never sent by the client. */
            cw1OrgCode: string | null;
            /** @description Who at the customer submitted it. Null once that user is removed. */
            requestedByName: string | null;
            grossWeightKg: number | null;
            volumeM3: number | null;
            chargeableKg: number | null;
            /** @description The CUSTOMER's remarks. Never written by staff. */
            notes: string | null;
            /** @description The pricer's covering draft. Sent only on publish. */
            messageToCustomer: string | null;
            /** @description Cargo lines and the long tail of the request, as submitted. */
            payload: Record<string, never>;
            /** @description What the customer declared. Empty when the request carries none. */
            dangerousGoods: components["schemas"]["DangerousGoodsEntryDto"][];
            /** @description What a per-container charge multiplies by. Empty unless a full-load request. */
            equipment: components["schemas"]["QuoteEquipmentDto"][];
            /** @description Null unless a reefer. */
            temperatureControl: components["schemas"]["TemperatureControlDto"] | null;
            /** @description Lifting equipment is quoted per piece. */
            oversizeItems: components["schemas"]["OversizeItemDto"][];
            /** Format: uuid */
            claimedById: string | null;
            claimedByName: string | null;
            /** Format: date-time */
            claimedAt: string | null;
            /** Format: date-time */
            claimExpiresAt: string | null;
            claimedByMe: boolean;
            pricedByName: string | null;
            /**
             * Format: uuid
             * @description So the screen can honour the four-eyes rule.
             */
            pricedById: string | null;
            /** @description True when the acting user priced it and so may not approve it. */
            pricedByMe: boolean;
            approvedByName: string | null;
            /** Format: date-time */
            approvedAt: string | null;
            /** Format: date-time */
            publishedAt: string | null;
            options: components["schemas"]["QuoteOptionDto"][];
            /** Format: date-time */
            createdAt: string;
            /** @description quotations.costCapture AND pricing.cost.view. */
            canRecordCost: boolean;
            /** @description quotations.disclose - does the customer see the carrier. */
            disclosesCarrier: boolean;
            /** @description Default validity in days, pre-filled on a new option. */
            defaultValidityDays: number;
            /** @description quotations.approval. */
            approvalRequired: boolean;
            /** @description Approval threshold in EUR minor units. */
            approvalThresholdMinorUnits: number;
            /**
             * @description quotations.pubMode.
             * @enum {string}
             */
            publicationMode: "cw1" | "direct";
            /** @description Suggested charge bases. A hint list, never validation. */
            chargeBases: string[];
            /** @description Carriers from the `carrier` lookup, filtered to this quote's mode. A suggestion list: the field still accepts any name typed. */
            carrierOptions: string[];
            /** @description Charge codes from the `charge_code` lookup. Code and meaning both, because FRT tells a new pricer nothing. A suggestion list: the field still accepts any code typed. */
            chargeCodes: components["schemas"]["ReferenceItemDto"][];
            /** @description Currencies from the `currency` lookup, for the per-line currency column. */
            currencyOptions: components["schemas"]["ReferenceItemDto"][];
        };
        ClaimResultDto: {
            /** Format: date-time */
            claimedAt: string;
            /** Format: date-time */
            claimExpiresAt: string;
        };
        ForceReleaseDto: {
            reason: string;
        };
        ChargeLineInputDto: {
            code: string | null;
            description: string;
            basis: string | null;
            quantity: number;
            rateMinorUnits: number;
            currency: string;
            /** @description Refused unless cost capture is permitted. */
            costMinorUnits: number | null;
        };
        QuoteOptionInputDto: {
            name: string | null;
            carrierName: string | null;
            serviceRouting: string | null;
            transitDaysMin: number | null;
            transitDaysMax: number | null;
            nextDepartures: string | null;
            freeTimeDays: number | null;
            /** Format: date-time */
            validUntil: string | null;
            isRecommended: boolean;
            notes: string | null;
            termsIncluded: string | null;
            termsExcluded: string | null;
            termsPayment: string | null;
            termsSubjectTo: string | null;
            chargeLines: components["schemas"]["ChargeLineInputDto"][];
        };
        PriceQuoteDto: {
            options: components["schemas"]["QuoteOptionInputDto"][];
            messageToCustomer: string | null;
        };
        PriceResultDto: {
            /** @enum {string} */
            status: "draft" | "requested" | "claimed" | "priced" | "approved" | "published" | "submitted" | "quoted" | "pending_sync" | "rated" | "rate_failed" | "expired" | "accepted" | "rejected" | "withdrawn";
            version: number;
        };
        AssistFileDto: {
            /** @description application/pdf, image/png, image/jpeg or image/webp. */
            mimeType: string;
            dataBase64: string;
        };
        AssistDraftOptionDto: {
            name?: string;
            carrierName?: string;
            transitDaysMin?: number | null;
            transitDaysMax?: number | null;
            freeTimeDays?: number | null;
            validUntil?: string;
            currency?: string;
            /** @description Decimal major units, for wording only. */
            total?: number;
        };
        PricingAssistRequestDto: {
            /** @enum {string} */
            want: "brief" | "scaffold" | "reply" | "message";
            count?: number;
            /** @enum {string} */
            target?: "current" | "new";
            existing?: number;
            /** @description Demo only: indicative figures. */
            fill?: boolean;
            text?: string;
            file?: components["schemas"]["AssistFileDto"];
            locale?: string;
            draft?: components["schemas"]["AssistDraftOptionDto"][];
        };
        AssistDerivedDto: {
            rule: string;
            text: string;
        };
        AssistLineDto: {
            code: string;
            description: string;
            basis: string;
            quantity: string;
            /** @description Decimal major units as the carrier wrote it. Blank when scaffolded. */
            rate: string;
            currency: string;
            /** @description Why this line is here. Shown beside it, never stored. */
            reason: string;
            /** @description True where the rate is a demonstration figure. */
            indicative: boolean;
        };
        AssistOptionDto: {
            name: string;
            carrierName: string;
            serviceRouting: string;
            transitDaysMin: string;
            transitDaysMax: string;
            nextDepartures: string;
            freeTimeDays: string;
            validUntil: string;
            currency: string;
            notes: string;
            lines: components["schemas"]["AssistLineDto"][];
        };
        AssistQuestionDto: {
            id: string;
            /** @description Which option the answer belongs to. -1 for the quote. */
            optionIndex: number;
            field: string;
            ask: string;
        };
        PricingAssistDto: {
            /** @enum {string} */
            status: "ready" | "not-configured" | "unreadable";
            detail?: string;
            provenance: {
                [key: string]: unknown;
            };
            /** @description What the assistant says, in order. */
            say: string[];
            /** @description Why it proposed what it did. */
            derived: components["schemas"]["AssistDerivedDto"][];
            /** @description Proposed options. Empty for a brief. */
            options: components["schemas"]["AssistOptionDto"][];
            questions: components["schemas"]["AssistQuestionDto"][];
            /**
             * @description Whether the SPA should rewrite the open option or add one.
             * @enum {string}
             */
            target: "current" | "new";
            /** @description True where the rates are demonstration figures a pricer must replace. */
            indicative: boolean;
            /** @description A covering note draft. Present only for want=message. */
            message?: string;
        };
        DecisionResultDto: {
            /** @enum {string} */
            status: "draft" | "requested" | "claimed" | "priced" | "approved" | "published" | "submitted" | "quoted" | "pending_sync" | "rated" | "rate_failed" | "expired" | "accepted" | "rejected" | "withdrawn";
        };
        SendBackDto: {
            /** @description Shown to the pricer. */
            reason: string;
        };
        PublishResultDto: {
            /** @enum {string} */
            status: "draft" | "requested" | "claimed" | "priced" | "approved" | "published" | "submitted" | "quoted" | "pending_sync" | "rated" | "rate_failed" | "expired" | "accepted" | "rejected" | "withdrawn";
            /** Format: date-time */
            publishedAt: string;
        };
        QuoteInsightKpisDto: {
            /** @description Requests with pricing still to come. */
            openRequests: number;
            /** @description Of those, how many already have options to read. */
            withOptionsReady: number;
            /** @description Published quotes whose validity ends within seven days. */
            expiringThisWeek: number;
            /** @description The soonest of them. */
            expiringReference: string | null;
            /** @description ISO date it lapses. */
            expiringOn: string | null;
            /** @description Accepted in the last twelve months. */
            accepted: number;
            /** @description Priced in the same window, the denominator for the rate. */
            priced: number;
            /** @description Median hours from request to published options. Null until anything has been priced. */
            medianHoursToPrice: number | null;
            /** @description SAMPLED. Share answered from a contract rate with no person involved. */
            instantPercent: number;
            /** @description SAMPLED. Minor units saved against market spot, year to date. */
            savedVsSpotMinorUnits: number;
        };
        QuoteInsightWaitingDto: {
            id: string;
            reference: string;
            originCode: string;
            destinationCode: string;
            /** @description e.g. "Sea FCL · 2 x 40 HC · 3 options". */
            summary: string;
            /**
             * @description Which of the three states this card is in. Decides its rule and badge.
             * @enum {string}
             */
            state: "options_ready" | "expiring" | "with_desk";
            /** @description The badge text, e.g. "Expires in 3 days". */
            badge: string;
            /** @description Cheapest published option. Null while the request is still with the pricing desk. */
            fromMinorUnits: number | null;
            currency: string | null;
            /** @description ISO date the price stops holding. */
            validUntil: string | null;
            daysLeft: number | null;
            /** @description Who is pricing it, where a request is with the desk. Never an internal id. */
            deskName: string | null;
        };
        QuoteInsightFunnelStepDto: {
            /** @description requested | priced | accepted | booked. */
            key: string;
            /** @description Null where the platform cannot count it yet. */
            count: number | null;
            /** @description Percent of the previous step that reached this one. */
            movePercent: number | null;
        };
        QuoteInsightRatePointDto: {
            month: string;
            /** @description What this customer pays on contract, minor units. */
            contractMinorUnits: number;
            /** @description SAMPLED. Market spot for the same lane and equipment. */
            spotMinorUnits: number;
        };
        QuoteInsightRateLaneDto: {
            key: string;
            /** @description e.g. "CNTAO to ESVLC". */
            label: string;
            /** @description e.g. "40 HC". */
            basis: string;
            currency: string;
            points: components["schemas"]["QuoteInsightRatePointDto"][];
            /** @description Average saving against spot across the window, whole percent. */
            savingPercent: number;
        };
        QuoteInsightSpeedModeDto: {
            /** @description A load type or handling case, e.g. "Sea FCL" or "Dangerous goods". */
            key: string;
            /** @description Median hours. Null when nothing has been priced. */
            hours: number | null;
            /** @description SAMPLED. True where a contract rate answers without a person. */
            instant: boolean;
        };
        QuoteInsightRecentDto: {
            id: string;
            reference: string;
            originCode: string;
            destinationCode: string;
            mode: string;
            /** @description ISO date the request was sent. */
            sentAt: string;
            /** @description The pipeline segment key, for the pill. */
            status: string;
            priceMinorUnits: number | null;
            currency: string | null;
            /** @description What happens next, or what happened, in one phrase. */
            next: string;
        };
        QuoteInsightReuseDto: {
            id: string;
            originCode: string;
            destinationCode: string;
            mode: string;
            /** @description e.g. "Sea FCL · 2 x 40 HC". */
            summary: string;
            /** @description e.g. "Accepted 12 Sep". */
            outcome: string;
        };
        QuoteInsightsDto: {
            asOf: string;
            currency: string;
            /** @description Panels whose figures are generated rather than measured. The screen marks these and only these. */
            sampled: string[];
            kpis: components["schemas"]["QuoteInsightKpisDto"];
            waiting: components["schemas"]["QuoteInsightWaitingDto"][];
            funnel: components["schemas"]["QuoteInsightFunnelStepDto"][];
            /** @description The one thing worth saying about the funnel, e.g. how many lapsed unanswered. */
            funnelNote: string | null;
            rateLanes: components["schemas"]["QuoteInsightRateLaneDto"][];
            speed: components["schemas"]["QuoteInsightSpeedModeDto"][];
            recent: components["schemas"]["QuoteInsightRecentDto"][];
            reuse: components["schemas"]["QuoteInsightReuseDto"][];
        };
        CustomerQuoteSummaryDto: {
            /** Format: uuid */
            id: string;
            reference: string;
            /**
             * @description Coarse grain. claimed, priced and approved all collapse to in_progress.
             * @enum {string}
             */
            statusBadge: "draft" | "requested" | "in_progress" | "quoted" | "accepted" | "rejected" | "expired" | "withdrawn";
            /** @enum {string} */
            mode: "air" | "sea" | "road" | "rail";
            originCode: string;
            destinationCode: string;
            customerReference: string | null;
            version: number;
            /** @description Null until published. */
            totalMinorUnits: number | null;
            currency: string | null;
            /** Format: date-time */
            validUntil: string | null;
            /** Format: date-time */
            createdAt: string;
            /** @description Options the customer can see. Zero before publication. */
            optionCount: number;
            /** @description Published, in date, and not yet answered. */
            awaitingDecision: boolean;
            /** @description What is being moved, in parts. The browser writes the caption. */
            cargo: components["schemas"]["QuoteCargoDto"];
            /** @description Whole days until the offer lapses, floored. Null when nothing has been published. Zero or less means it has lapsed. */
            daysRemaining: number | null;
            /**
             * @description Which band of the pipeline this row belongs to. Derived by the server so the segment count, the segment filter and the row agree.
             * @enum {string}
             */
            pipelineSegment: "submitted" | "in_progress" | "options_ready" | "expiring_soon" | "accepted" | "declined" | "expired";
        };
        CustomerQuoteListDto: {
            items: components["schemas"]["CustomerQuoteSummaryDto"][];
            total: number;
            /** @description The pipeline band. Counted across everything the customer may see, ignoring the segment filter itself, so picking a segment does not erase the others. */
            pipeline: components["schemas"]["QuotePipelineSegmentDto"][];
            /** @description The signed-in customer's own name, for the band's eyebrow. Resolved under the caller's own tenancy, so it can only ever be their own. */
            customerName: string | null;
        };
        CustomerQuoteChargeLineDto: {
            description: string | null;
            basis: string | null;
            quantity: number;
            /** @description Minor units. */
            amountMinorUnits: number;
            currency: string;
        };
        CustomerQuoteOptionDto: {
            /** Format: uuid */
            id: string;
            position: number;
            name: string | null;
            /** @description Null when the branch does not disclose the carrier before booking. */
            carrierName: string | null;
            serviceRouting: string | null;
            transitDaysMin: number | null;
            transitDaysMax: number | null;
            nextDepartures: string | null;
            freeTimeDays: number | null;
            totalMinorUnits: number | null;
            currency: string | null;
            /** Format: date-time */
            validUntil: string | null;
            isRecommended: boolean;
            /** @description Past its validity. Decided by the server clock, because that is the clock that will refuse the acceptance. */
            isExpired: boolean;
            notes: string | null;
            termsIncluded: string | null;
            termsExcluded: string | null;
            termsPayment: string | null;
            termsSubjectTo: string | null;
            /** @description Never carries cost or margin. */
            chargeLines: components["schemas"]["CustomerQuoteChargeLineDto"][];
        };
        CustomerQuoteDto: {
            /** Format: uuid */
            id: string;
            reference: string;
            /**
             * @description Coarse grain. claimed, priced and approved all collapse to in_progress.
             * @enum {string}
             */
            statusBadge: "draft" | "requested" | "in_progress" | "quoted" | "accepted" | "rejected" | "expired" | "withdrawn";
            /** @enum {string} */
            mode: "air" | "sea" | "road" | "rail";
            originCode: string;
            destinationCode: string;
            customerReference: string | null;
            version: number;
            /** @description Null until published. */
            totalMinorUnits: number | null;
            currency: string | null;
            /** Format: date-time */
            validUntil: string | null;
            /** Format: date-time */
            createdAt: string;
            /** @description Options the customer can see. Zero before publication. */
            optionCount: number;
            /** @description Published, in date, and not yet answered. */
            awaitingDecision: boolean;
            /** @description What is being moved, in parts. The browser writes the caption. */
            cargo: components["schemas"]["QuoteCargoDto"];
            /** @description Whole days until the offer lapses, floored. Null when nothing has been published. Zero or less means it has lapsed. */
            daysRemaining: number | null;
            /**
             * @description Which band of the pipeline this row belongs to. Derived by the server so the segment count, the segment filter and the row agree.
             * @enum {string}
             */
            pipelineSegment: "submitted" | "in_progress" | "options_ready" | "expiring_soon" | "accepted" | "declined" | "expired";
            /**
             * @description The raw status. Use statusBadge for display.
             * @enum {string}
             */
            status: "draft" | "requested" | "claimed" | "priced" | "approved" | "published" | "submitted" | "quoted" | "pending_sync" | "rated" | "rate_failed" | "expired" | "accepted" | "rejected" | "withdrawn";
            /** @enum {string} */
            stage: "requested" | "claimed" | "priced" | "confirmed" | "ready";
            /** @description Completed steps of the five-step journey. */
            stageIndex: number;
            incoterm: string | null;
            /** @description load_type lookup code; absent for air. */
            loadType: string | null;
            /** Format: date-time */
            readyDate: string | null;
            serviceLevel: string | null;
            grossWeightKg: number | null;
            volumeM3: number | null;
            chargeableKg: number | null;
            /** @description The customer's own remarks. */
            notes: string | null;
            /** @description The covering message, once published. */
            messageToCustomer: string | null;
            /** @description The request as submitted, for review and for copying. */
            payload: Record<string, never>;
            /** Format: date-time */
            publishedAt: string | null;
            /** Format: date-time */
            decidedAt: string | null;
            /**
             * Format: uuid
             * @description The option the customer accepted.
             */
            acceptedOptionId: string | null;
            /** @description Why the customer declined. */
            declineReason: string | null;
            /** @description Empty until published. */
            options: components["schemas"]["CustomerQuoteOptionDto"][];
            /** @description What the customer declared. Shown back to them so they can check it. */
            dangerousGoods: components["schemas"]["DangerousGoodsEntryDto"][];
            /** @description Empty unless a full-load request. */
            equipment: components["schemas"]["QuoteEquipmentDto"][];
            temperatureControl: components["schemas"]["TemperatureControlDto"] | null;
            oversizeItems: components["schemas"]["OversizeItemDto"][];
        };
        PackageLineInputDto: {
            /** @description Stable id for this line, so a dangerous goods entry can name it. */
            lineId?: string;
            quantity: number;
            packageType: string;
            lengthCm?: number;
            widthCm?: number;
            heightCm?: number;
            weightKg: number;
            description?: string;
        };
        DangerousGoodsInputDto: {
            /**
             * @description Four digits.
             * @example 1263
             */
            unNumber: string;
            /**
             * @description hazard_class lookup code.
             * @example 3
             */
            hazardClass: string;
            properShippingName: string;
            /** @description hazard_class codes. */
            subsidiaryRisks?: string[];
            /**
             * @description 'NONE' where the entry is not assigned one.
             * @enum {string}
             */
            packingGroup: "I" | "II" | "III" | "NONE";
            /** @description Required for an n.o.s. entry. */
            technicalName?: string;
            /** @description Required when class 3 applies. */
            flashpointCelsius?: number;
            emsCode?: string;
            isMarinePollutant?: boolean;
            packagingType: string;
            unPackagingCode?: string;
            packageCount: number;
            netQuantityPerPackage: number;
            /** @description dg_quantity_unit lookup code. */
            quantityUnit: string;
            /** @description dg_transport_regime lookup code. */
            transportRegime?: string;
            isInOverpack?: boolean;
            /** @description lineId values this entry travels in. At least one. */
            appliesToLines: string[];
            notes?: string;
        };
        EquipmentInputDto: {
            /** @description Stable id within this request. */
            unitId: string;
            /**
             * @description container_type lookup code.
             * @example 40HC
             */
            containerType: string;
            quantity: number;
            /** @description Expected load per container. Indicative; nothing refuses on it. */
            grossWeightPerUnitKg?: number;
            notes?: string;
        };
        TemperatureControlInputDto: {
            /** @description Celsius, -70 to 40. Negative is ordinary. */
            setPointCelsius: number;
            /** @description Plus or minus. Zero is valid. */
            toleranceCelsius?: number;
            /** @description reefer_ventilation lookup code. */
            ventilation?: string;
            controlledAtmosphere?: boolean;
            preCoolingRequired?: boolean;
            /** @description reefer_data_logger lookup code. */
            dataLogger?: string;
            notes?: string;
        };
        OversizeItemInputDto: {
            description: string;
            lengthCm: number;
            widthCm: number;
            heightCm: number;
            weightKg: number;
            /** @description lifting_method lookup code. */
            liftingMethod?: string;
            notes?: string;
        };
        CreateQuoteDto: {
            /** Format: uuid */
            accountId?: string;
            /** @enum {string} */
            mode: "air" | "sea" | "road" | "rail";
            /**
             * @description load_type lookup code. FCL and FTL require at least one container.
             * @example FCL
             */
            loadType?: string;
            /**
             * @description UN/LOCODE.
             * @example CNTAO
             */
            originCode: string;
            /**
             * @description UN/LOCODE.
             * @example ESVLC
             */
            destinationCode: string;
            /**
             * @description What is being shipped.
             * @example Ceramic tiles
             */
            commodity: string;
            grossWeightKg: number;
            volumeM3?: number;
            /** @default EUR */
            currency: string;
            packages?: components["schemas"]["PackageLineInputDto"][];
            /** @enum {string} */
            incoterm?: "EXW" | "FCA" | "CPT" | "CIP" | "DAP" | "DPU" | "DDP" | "FAS" | "FOB" | "CFR" | "CIF";
            /** Format: date-time */
            readyDate?: string;
            customerReference?: string;
            serviceLevel?: string;
            /** @description The customer's own remarks. */
            notes?: string;
            dangerousGoods?: components["schemas"]["DangerousGoodsInputDto"][];
            equipment?: components["schemas"]["EquipmentInputDto"][];
            temperatureControl?: components["schemas"]["TemperatureControlInputDto"];
            oversizeItems?: components["schemas"]["OversizeItemInputDto"][];
            /** @description The long tail of the request: handling flags, customs data, parties. */
            payload?: {
                [key: string]: unknown;
            };
        };
        QuoteCreatedDto: {
            /** Format: uuid */
            id: string;
            reference: string;
            /** @enum {string} */
            status: "draft" | "requested" | "claimed" | "priced" | "approved" | "published" | "submitted" | "quoted" | "pending_sync" | "rated" | "rate_failed" | "expired" | "accepted" | "rejected" | "withdrawn";
        };
        QuoteRateResultDto: {
            /** Format: uuid */
            id: string;
            /** @description Minor units. */
            totalMinorUnits: number;
            currency: string;
            /** Format: date-time */
            validUntil: string;
        };
        QuoteStatusResultDto: {
            /** @enum {string} */
            status: "draft" | "requested" | "claimed" | "priced" | "approved" | "published" | "submitted" | "quoted" | "pending_sync" | "rated" | "rate_failed" | "expired" | "accepted" | "rejected" | "withdrawn";
        };
        AcceptQuoteDto: {
            /** Format: uuid */
            optionId: string;
            /** @description The version the customer was looking at. */
            version: number;
        };
        DeclineQuoteDto: {
            reason: string | null;
        };
        SettingOptionDto: {
            value: string;
            label: string;
        };
        ResolvedSettingDto: {
            /** @enum {string} */
            key: "quotations.pubMode" | "quotations.sendReqCw1" | "organisations.fourEyes" | "quotations.approval" | "quotations.threshold" | "quotations.claimExpiry" | "quotations.releaseBy" | "quotations.costCapture" | "quotations.disclose" | "quotations.validity" | "quotations.draftSvc" | "quotations.co2";
            /** @description The value that applies, after the hierarchy has been walked. */
            value: boolean | number | string;
            /**
             * @description Which layer supplied the value. The screen prints this.
             * @enum {string}
             */
            source: "global" | "region" | "branch" | "customer" | "default";
            sourceId: string | null;
        };
        SettingOverrideDto: {
            /** @enum {string} */
            scope: "global" | "region" | "branch" | "customer";
            scopeId: string | null;
            value: boolean | number | string;
            /** @description False when the stored value no longer fits the catalogue, so the resolver skips it. */
            valid: boolean;
            reason: string;
            updatedBy: string | null;
            /** Format: date-time */
            updatedAt: string;
        };
        SettingDto: {
            /** @enum {string} */
            key: "quotations.pubMode" | "quotations.sendReqCw1" | "organisations.fourEyes" | "quotations.approval" | "quotations.threshold" | "quotations.claimExpiry" | "quotations.releaseBy" | "quotations.costCapture" | "quotations.disclose" | "quotations.validity" | "quotations.draftSvc" | "quotations.co2";
            /** @enum {string} */
            group: "publication" | "organisation_linking" | "approval" | "ownership" | "pricing_information" | "customer_presentation" | "communication" | "feature_availability";
            /** @enum {string} */
            type: "boolean" | "number" | "enum";
            /** @description English fallback; the client translates by key. */
            label: string;
            description: string;
            /** @description hours, days, EUR. */
            unit: string | null;
            options: components["schemas"]["SettingOptionDto"][] | null;
            min: number | null;
            max: number | null;
            defaultValue: boolean | number | string;
            /** @description Platform switch that must be on for this setting to be read at all. */
            requiresSwitch: string | null;
            effective: components["schemas"]["ResolvedSettingDto"];
            overrides: components["schemas"]["SettingOverrideDto"][];
        };
        SettingChangeDto: {
            id: string;
            actorUserId: string | null;
            action: string;
            /** @description The setting key. */
            entityId: string | null;
            metadata: Record<string, never>;
            /** Format: date-time */
            createdAt: string;
        };
        SetSettingDto: {
            /** @enum {string} */
            scope: "global" | "region" | "branch" | "customer";
            scopeId: string | null;
            value: boolean | number | string;
            reason: string;
        };
        StaffBranchDto: {
            /** Format: uuid */
            id: string;
            code: string;
            name: string;
            city: string | null;
            countryCode: string | null;
            regionName: string | null;
        };
        StaffSecurityDto: {
            hasPassword: boolean;
            credentialDisabled: boolean;
            mfaEnrolled: boolean;
            activeSessions: number;
            /** @description An unspent invitation or reset link is live. */
            pendingActivationLink: boolean;
            /** Format: date-time */
            pendingLinkExpiresAt: string | null;
        };
        StaffUserDto: {
            /** Format: uuid */
            id: string;
            displayName: string;
            /** Format: email */
            email: string;
            /** @enum {string} */
            status: "registered" | "invited" | "active" | "suspended" | "disabled";
            roleKeys: string[];
            permissions: string[];
            branch: components["schemas"]["StaffBranchDto"] | null;
            /** Format: date-time */
            lastLoginAt: string | null;
            /** @description Signs in with Microsoft, so needs no portal password. */
            usesSso: boolean;
            /** Format: date-time */
            updatedAt: string;
            /** @description Null when portal password sign-in is switched off. */
            security: components["schemas"]["StaffSecurityDto"] | null;
        };
        StaffListDto: {
            items: components["schemas"]["StaffUserDto"][];
            total: number;
            page: number;
            pageSize: number;
        };
        StaffRolePresetDto: {
            /** @enum {string} */
            key: "platform_admin" | "customer_success" | "pricing" | "pricing_approver" | "ops";
            permissions: string[];
        };
        StaffRoleUpdateDto: {
            roleKeys: ("platform_admin" | "customer_success" | "pricing" | "pricing_approver" | "ops")[];
            /** Format: uuid */
            branchId: string | null;
            /** Format: date-time */
            updatedAt: string;
            reason: string;
        };
        StaffAccessLinkDto: {
            reason: string;
        };
        StaffAccessLinkResultDto: {
            /** @description Present only while no email transport is configured. */
            link: string | null;
            emailStatus: string;
            /** Format: date-time */
            expiresAt: string;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    HealthController_live: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Process is responding. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    HealthController_ready: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Database is reachable. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Database readiness check failed. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    IntegrationSyncController_status: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                portalRef: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IntegrationSyncStatusDto"];
                };
            };
        };
    };
    AccountController_overview: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountOverviewDto"];
                };
            };
        };
    };
    AccountController_users: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountUserDto"][];
                };
            };
        };
    };
    AccountController_rolePresets: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountRolePresetDto"][];
                };
            };
        };
    };
    AccountController_invitations: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountInvitationDto"][];
                };
            };
        };
    };
    AccountController_invite: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["InviteColleagueDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountInvitationDto"];
                };
            };
        };
    };
    AccountController_resend: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AccountActionReasonDto"];
            };
        };
        responses: {
            /** @description Issues a new link; the previous one stops working. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountInvitationDto"];
                };
            };
        };
    };
    AccountController_revoke: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AccountActionReasonDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountInvitationDto"];
                };
            };
        };
    };
    AccountController_changeRoles: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ChangeRolesDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountUserDto"];
                };
            };
        };
    };
    AccountController_deactivate: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AccountActionReasonDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountUserDto"];
                };
            };
        };
    };
    AccountController_reactivate: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AccountActionReasonDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountUserDto"];
                };
            };
        };
    };
    AiIntakeController_availability: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IntakeAvailabilityDto"];
                };
            };
        };
    };
    AiIntakeController_quoteIntake: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["IntakeRequestDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IntakeDraftDto"];
                };
            };
        };
    };
    CustomersController_list: {
        parameters: {
            query?: {
                pageSize?: number;
                page?: number;
                blocked?: boolean;
                countryCode?: string;
                status?: "all" | "draft" | "onboarding" | "active" | "suspended" | "closed";
                search?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CustomerListDto"];
                };
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    CustomersController_create: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CustomerCreateDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CustomerDetailDto"];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    CustomersController_directory: {
        parameters: {
            query?: {
                pageSize?: number;
                page?: number;
                unlinkedOnly?: boolean;
                countryCode?: string;
                search?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DirectoryListDto"];
                };
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    CustomersController_detail: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CustomerDetailDto"];
                };
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    CustomersController_update: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CustomerUpdateDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CustomerDetailDto"];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    CustomersController_goLive: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CustomerStatusChangeDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CustomerDetailDto"];
                };
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Not ready: the response names what is missing. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    CustomersController_suspend: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CustomerStatusChangeDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CustomerDetailDto"];
                };
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    CustomersController_close: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CustomerStatusChangeDto"];
            };
        };
        responses: {
            /** @description Closing releases the organisation codes for reuse. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CustomerDetailDto"];
                };
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    CustomersController_discard: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CustomerStatusChangeDto"];
            };
        };
        responses: {
            /** @description Only a customer that never went live and has no users. */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    CustomersController_attach: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["OrganisationLinkCreateDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CustomerDetailDto"];
                };
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Not eligible, or the code already belongs to another customer. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    CustomersController_detach: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                accountId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["OrganisationLinkRemoveDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CustomerDetailDto"];
                };
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    CustomersController_setLinkServicing: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                accountId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["OrganisationLinkServicingDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CustomerDetailDto"];
                };
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The office is no longer active. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    CustomersController_invitations: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["InvitationDto"][];
                };
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    CustomersController_inviteAdministrator: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["InviteAdministratorDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["InvitationDto"];
                };
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    CustomersController_resendInvitation: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                invitationId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AccountActionDto"];
            };
        };
        responses: {
            /** @description Issues a new link; the previous one stops working. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["InvitationDto"];
                };
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The invitation is no longer pending. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    CustomersController_revokeInvitation: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                invitationId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AccountActionDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["InvitationDto"];
                };
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The invitation is no longer pending. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    CustomersController_users: {
        parameters: {
            query?: {
                pageSize?: number;
                page?: number;
                search?: string;
            };
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CustomerUserListDto"];
                };
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    CustomersController_sendPasswordReset: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                userId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AccountActionDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountActionResultDto"];
                };
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    CustomersController_blockSignIn: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                userId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AccountActionDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountActionResultDto"];
                };
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    CustomersController_restoreSignIn: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                userId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AccountActionDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountActionResultDto"];
                };
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    CustomersController_resetUserMfa: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                userId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AccountActionDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountActionResultDto"];
                };
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    CustomersController_updateUserAccess: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                userId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UserAccessUpdateDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CustomerUserListDto"];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    DashboardController_analytics: {
        parameters: {
            query?: {
                period?: "3m" | "6m" | "12m";
                mode?: "all" | "sea_fcl" | "sea_lcl" | "air";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DashboardAnalyticsDto"];
                };
            };
        };
    };
    DocumentsController_list: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                quoteId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["QuoteDocumentDto"][];
                };
            };
        };
    };
    DocumentsController_upload: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                quoteId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": components["schemas"]["UploadQuoteDocumentDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["InternalQuoteDocumentDto"];
                };
            };
        };
    };
    DocumentsController_listInternal: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                quoteId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["InternalQuoteDocumentDto"][];
                };
            };
        };
    };
    DocumentsController_download: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                documentId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    DocumentsController_remove: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                documentId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    FeaturesController_list: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FeatureSwitchListDto"];
                };
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    FeaturesController_update: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                key: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["FeatureSwitchUpdateDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FeatureSwitchDto"];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    DevIdentityController_users: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DevIdentityListDto"];
                };
            };
        };
    };
    IdentityController_me: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CurrentUserDto"];
                };
            };
        };
    };
    IdentityController_health: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    LocalAuthController_signIn: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LocalLoginDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LocalSessionDto"];
                };
            };
            /** @description Wrong details, or too many attempts. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    LocalAuthController_signOut: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    LocalAuthController_signOutEverywhere: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Number of other sessions ended. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LocalSignOutEverywhereDto"];
                };
            };
        };
    };
    LocalAuthController_verifyMfa: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LocalMfaVerifyDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LocalSessionDto"];
                };
            };
        };
    };
    LocalAuthController_beginMfaEnrolment: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LocalMfaEnrolmentDto"];
                };
            };
        };
    };
    LocalAuthController_confirmMfaEnrolment: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LocalMfaConfirmDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LocalRecoveryCodesDto"];
                };
            };
        };
    };
    LocalAuthController_accountStatus: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LocalAccountStatusDto"];
                };
            };
            /** @description No session, or the second factor is still outstanding. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    LocalAuthController_regenerateRecoveryCodes: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Retires the previous set. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LocalRecoveryCodesDto"];
                };
            };
        };
    };
    LocalAuthController_replaceMfa: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LocalPasswordConfirmDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LocalMfaEnrolmentDto"];
                };
            };
        };
    };
    LocalAuthController_removeMfa: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LocalPasswordConfirmDto"];
            };
        };
        responses: {
            /** @description Noatum accounts must keep a second factor. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    LocalAuthController_activationSubject: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                token: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LocalActivationSubjectDto"];
                };
            };
            /** @description Expired or already used. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    LocalAuthController_activate: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LocalActivateDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LocalSessionDto"];
                };
            };
        };
    };
    LocalAuthController_completeBootstrap: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LocalActivateDto"];
            };
        };
        responses: {
            /** @description Completes first-administrator setup. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LocalSessionDto"];
                };
            };
        };
    };
    LocalAuthController_requestPasswordReset: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LocalPasswordResetRequestDto"];
            };
        };
        responses: {
            /** @description Always accepted, whether or not the address is known. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    LocalAuthController_completeReset: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LocalActivateDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LocalSessionDto"];
                };
            };
        };
    };
    LocalAuthController_changePassword: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LocalPasswordChangeDto"];
            };
        };
        responses: {
            /** @description No session, or the current password is wrong. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    LookupsController_categories: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LookupCategoryDto"][];
                };
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    LookupsController_createCategory: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LookupCategoryCreateDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LookupCategoryDto"];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    LookupsController_updateCategory: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                code: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LookupCategoryUpdateDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LookupCategoryDto"];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    LookupsController_items: {
        parameters: {
            query?: {
                pageSize?: number;
                page?: number;
                parentCode?: string;
                visibility?: "all" | "customer" | "internal";
                status?: "all" | "active" | "inactive";
                search?: string;
            };
            header?: never;
            path: {
                code: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LookupItemListDto"];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    LookupsController_createItem: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                code: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LookupItemCreateDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LookupItemDto"];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    LookupsController_parentOptions: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                code: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LookupItemDto"][];
                };
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    LookupsController_updateItem: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LookupItemUpdateDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LookupItemDto"];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    OperatingController_listRegions: {
        parameters: {
            query?: {
                pageSize?: number;
                page?: number;
                status?: "all" | "active" | "inactive";
                search?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RegionListDto"];
                };
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    OperatingController_createRegion: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RegionCreateDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RegionDto"];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The region code already exists. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    OperatingController_updateRegion: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RegionUpdateDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RegionDto"];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    OperatingController_listBranches: {
        parameters: {
            query?: {
                pageSize?: number;
                page?: number;
                mapped?: "all" | "mapped" | "unmapped";
                status?: "all" | "active" | "inactive";
                regionId?: string;
                search?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BranchListDto"];
                };
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    OperatingController_createBranch: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["BranchCreateDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BranchDto"];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The branch code already exists, or the region is not available. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    OperatingController_branchDetail: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BranchDto"];
                };
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    OperatingController_updateBranch: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["BranchUpdateDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BranchDto"];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Stale record, region unavailable, or the branch is still in use. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    OperatingController_listCargoWiseBranches: {
        parameters: {
            query?: {
                mapped?: "all" | "mapped" | "unmapped";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CargoWiseBranchListDto"];
                };
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    OrganisationsController_list: {
        parameters: {
            query?: {
                pageSize?: number;
                page?: number;
                linked?: "all" | "linked" | "unlinked";
                provenance?: "all" | "confirmed" | "provisional";
                status?: "all" | "active" | "inactive";
                category?: string;
                countryCode?: string;
                search?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrganisationListDto"];
                };
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    OrganisationsController_detail: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrganisationDetailDto"];
                };
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    OrganisationsController_runs: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ImportRunListDto"];
                };
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    OrganisationsController_runImport: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ImportRunRequestDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ImportRunDto"];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    PortsController_search: {
        parameters: {
            query?: {
                /** @description Prefix of the port name, its UN/LOCODE or its country. Omit for the first page in name order. */
                q?: string;
                locale?: string;
                mode?: "sea" | "air";
                /** @description ISO 3166-1 alpha-2. */
                country?: string;
                limit?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PortDto"][];
                };
            };
        };
    };
    PricingController_queue: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PricingQueueEntryDto"][];
                };
            };
        };
    };
    PricingController_quotations: {
        parameters: {
            query: {
                search: string;
                segment: string;
                view: string;
                mode: string;
                requestedFrom: string;
                requestedTo: string;
                page: string;
                pageSize: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PricingQuotationListDto"];
                };
            };
        };
    };
    PricingController_detail: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PricingQuoteDto"];
                };
            };
        };
    };
    PricingController_claim: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ClaimResultDto"];
                };
            };
        };
    };
    PricingController_release: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    PricingController_forceRelease: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ForceReleaseDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    PricingController_price: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PriceQuoteDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PriceResultDto"];
                };
            };
        };
    };
    PricingController_assist: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PricingAssistRequestDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PricingAssistDto"];
                };
            };
        };
    };
    PricingController_approve: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DecisionResultDto"];
                };
            };
        };
    };
    PricingController_sendBack: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SendBackDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DecisionResultDto"];
                };
            };
        };
    };
    PricingController_publish: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublishResultDto"];
                };
            };
        };
    };
    QuotesController_quoteInsights: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["QuoteInsightsDto"];
                };
            };
        };
    };
    QuotesController_list: {
        parameters: {
            query: {
                search: string;
                badge: string;
                segment: string;
                view: string;
                mode: string;
                requestedFrom: string;
                requestedTo: string;
                page: string;
                pageSize: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CustomerQuoteListDto"];
                };
            };
        };
    };
    QuotesController_create: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateQuoteDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["QuoteCreatedDto"];
                };
            };
        };
    };
    QuotesController_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CustomerQuoteDto"];
                };
            };
        };
    };
    QuotesController_rate: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["QuoteRateResultDto"];
                };
            };
        };
    };
    QuotesController_submit: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["QuoteStatusResultDto"];
                };
            };
        };
    };
    QuotesController_accept: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AcceptQuoteDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["QuoteStatusResultDto"];
                };
            };
        };
    };
    QuotesController_decline: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["DeclineQuoteDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["QuoteStatusResultDto"];
                };
            };
        };
    };
    QuotesController_cancel: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["QuoteStatusResultDto"];
                };
            };
        };
    };
    ReferenceController_items: {
        parameters: {
            query?: {
                locale?: string;
                mode?: string;
            };
            header?: never;
            path: {
                category: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReferenceItemDto"][];
                };
            };
        };
    };
    SettingsController_list: {
        parameters: {
            query: {
                regionCode: string;
                branchCode: string;
                customerGroupId: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SettingDto"][];
                };
            };
        };
    };
    SettingsController_history: {
        parameters: {
            query: {
                take: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SettingChangeDto"][];
                };
            };
        };
    };
    SettingsController_set: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                key: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SetSettingDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ResolvedSettingDto"];
                };
            };
        };
    };
    SettingsController_clear: {
        parameters: {
            query: {
                scopeId: string;
            };
            header?: never;
            path: {
                key: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ResolvedSettingDto"];
                };
            };
        };
    };
    UsersController_list: {
        parameters: {
            query?: {
                pageSize?: number;
                page?: number;
                search?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StaffListDto"];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    UsersController_presets: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StaffRolePresetDto"][];
                };
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    UsersController_branches: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StaffBranchDto"][];
                };
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    UsersController_updateRoles: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["StaffRoleUpdateDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StaffUserDto"];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    UsersController_accessLink: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["StaffAccessLinkDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StaffAccessLinkResultDto"];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
}
