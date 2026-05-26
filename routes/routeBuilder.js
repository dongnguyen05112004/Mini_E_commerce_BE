const addCrudRoutes = (
  router,
  path,
  controller,
  {
    read = [],
    create = [],
    update = [],
    remove = [],
    allowCreate = true,
    allowUpdate = true,
    allowDelete = true,
  } = {}
) => {
  const collectionRoute = router.route(`/${path}`);
  collectionRoute.get(...read, controller.getAll);

  if (allowCreate) {
    collectionRoute.post(...create, controller.createOne);
  }

  const detailRoute = router.route(`/${path}/:id`);
  detailRoute.get(...read, controller.getById);

  if (allowUpdate) {
    detailRoute.put(...update, controller.updateOne);
    detailRoute.patch(...update, controller.updateOne);
  }

  if (allowDelete) {
    detailRoute.delete(...remove, controller.deleteOne);
  }
};

const addReadOnlyRoutes = (router, path, controller, read = []) => {
  addCrudRoutes(router, path, controller, {
    read,
    allowCreate: false,
    allowUpdate: false,
    allowDelete: false,
  });
};

module.exports = {
  addCrudRoutes,
  addReadOnlyRoutes,
};
