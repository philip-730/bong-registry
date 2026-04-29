{
  description = "bong-registry";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";

    uv2nix = {
      url = "github:pyproject-nix/uv2nix";
      inputs.pyproject-nix.follows = "pyproject-nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    pyproject-nix = {
      url = "github:pyproject-nix/pyproject.nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    pyproject-build-systems = {
      url = "github:pyproject-nix/build-system-pkgs";
      inputs.pyproject-nix.follows = "pyproject-nix";
      inputs.uv2nix.follows = "uv2nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
      uv2nix,
      pyproject-nix,
      pyproject-build-systems,
      ...
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        inherit (nixpkgs) lib;
        pkgs = nixpkgs.legacyPackages.${system};

        # ------------------------------------------------------------------ #
        # Backend — Python venv via uv2nix
        # ------------------------------------------------------------------ #
        workspace = uv2nix.lib.workspace.loadWorkspace {
          workspaceRoot = ./backend;
        };

        overlay = workspace.mkPyprojectOverlay {
          sourcePreference = "wheel";
        };

        pythonSet = (pkgs.callPackage pyproject-nix.build.packages {
          python = pkgs.python313;
        }).overrideScope (lib.composeManyExtensions [
          pyproject-build-systems.overlays.default
          overlay
        ]);

        backendVenv = pythonSet.mkVirtualEnv "bong-registry-backend-env"
          workspace.deps.default;

        backendDevVenv = pythonSet.mkVirtualEnv "bong-registry-backend-dev-env"
          workspace.deps.all;

        # ------------------------------------------------------------------ #
        # OCI images — Phase 4
        # ------------------------------------------------------------------ #

        backendImage = pkgs.dockerTools.streamLayeredImage {
          name = "ghcr.io/philip-730/bong-registry-backend";
          tag = "latest";
          contents = [ backendVenv pkgs.cacert ];
          # Copy alembic migration files into /app so `alembic upgrade head`
          # can be run from that directory (alembic.ini uses %(here)s).
          extraCommands = ''
            mkdir -p app
            cp -r ${./backend/alembic} app/alembic
            cp ${./backend/alembic.ini} app/alembic.ini
          '';
          config = {
            Cmd = [ "uvicorn" "app.main:app" "--host" "0.0.0.0" "--port" "8000" "--proxy-headers" ];
            WorkingDir = "/app";
            Env = [
              "PATH=${backendVenv}/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
              "SSL_CERT_FILE=${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt"
              "NIX_SSL_CERT_FILE=${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt"
            ];
            ExposedPorts."8000/tcp" = { };
          };
        };

        # Build the Next.js app in a Nix sandbox, then package the standalone
        # output with Node.js.
        #
        # Bootstrap: get the npmDepsHash by running:
        #   just npm-deps-hash
        # then paste the result below.
        frontendBuild = pkgs.buildNpmPackage {
          pname = "bong-registry-frontend";
          version = "0.1.0";
          src = lib.cleanSourceWith {
            src = ./frontend;
            # Exclude secrets and the local node_modules tree — buildNpmPackage
            # reinstalls deps from the lock file in the Nix sandbox anyway.
            filter = path: type:
              let name = baseNameOf (toString path);
              in !(lib.hasPrefix ".env" name) && name != "node_modules";
          };
          npmDepsHash = "sha256-mmJTZDUBLfRXPyeCqJs9gwiXaLhNXbiNCJstKRitugI=";
          NEXT_TELEMETRY_DISABLED = "1";
          preBuild = ''
            export NODE_ENV=production
          '';
          installPhase = ''
            runHook preInstall
            mkdir -p $out
            cp -r .next/standalone/. $out/
            mkdir -p $out/.next
            cp -r .next/static $out/.next/static
            cp -r public $out/public
            runHook postInstall
          '';
        };

        frontendImage = pkgs.dockerTools.streamLayeredImage {
          name = "ghcr.io/philip-730/bong-registry-frontend";
          tag = "latest";
          contents = [ pkgs.cacert pkgs.nodejs_24 frontendBuild ];
          config = {
            Cmd = [ "${pkgs.nodejs_24}/bin/node" "${frontendBuild}/server.js" ];
            WorkingDir = "${frontendBuild}";
            Env = [
              "NODE_ENV=production"
              "HOSTNAME=0.0.0.0"
              "PORT=3000"
              "NODE_EXTRA_CA_CERTS=${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt"
              "SSL_CERT_FILE=${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt"
            ];
            ExposedPorts."3000/tcp" = { };
          };
        };

        # ------------------------------------------------------------------ #
        # Dev shell package groups
        # ------------------------------------------------------------------ #
        k8sPackages = with pkgs; [
          kubectl
          kubernetes-helm
          k9s
          skopeo
        ];

        backendPackages = [
          backendDevVenv
          pkgs.python313
          pkgs.uv
          pkgs.just
          pkgs.postgresql
        ];

        frontendPackages = with pkgs; [
          nodejs_24
          just
        ];

      in
      {
        packages = {
          backend-image = backendImage;
          frontend-image = frontendImage;
        };

        devShells = {
          default = pkgs.mkShell {
            name = "bong-registry";
            packages = k8sPackages ++ backendPackages ++ frontendPackages;
            shellHook = ''
              echo "bong-registry dev shell"
              echo "  node $(node --version)  |  python $(python3 --version)  |  uvicorn $(uvicorn --version)"
            '';
          };

          backend = pkgs.mkShell {
            name = "bong-registry-backend";
            packages = backendPackages;
          };

          frontend = pkgs.mkShell {
            name = "bong-registry-frontend";
            packages = frontendPackages;
          };

          k8s = pkgs.mkShell {
            name = "bong-registry-k8s";
            packages = k8sPackages;
          };
        };
      }
    );
}
